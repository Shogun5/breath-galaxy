// Data sources. Both emit the same packets:
//   onPacket({kind:'eeg'|'ppg', ch, seq, samples})
//   onPacket({kind:'accel'|'gyro', seq, xyz:[[x,y,z]*3]})
//   onTelemetry({battery}), onDisconnect()

export const CHANNELS = ['TP9', 'AF7', 'AF8', 'TP10'];

const SERVICE = 0xfe8d;
const uuid = (s) => `273e${s}-4c4d-454d-96be-f03bac821358`;
const CONTROL = uuid('0001');
const EEG = ['0003', '0004', '0005', '0006'].map(uuid); // TP9, AF7, AF8, TP10
const PPG = ['000f', '0010', '0011'].map(uuid); // ambient, infrared, red
const ACCEL = uuid('000a');
const GYRO = uuid('0009');
const TELEMETRY = uuid('000b');

const encode = (cmd) => new TextEncoder().encode(`X${cmd}\n`).map((b, i, a) => (i === 0 ? a.length - 1 : b));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class MuseSource {
  name = 'Muse 2';
  onPacket = () => {};
  onTelemetry = () => {};
  onDisconnect = () => {};
  device = null;
  chars = [];
  intentional = false;

  async connect() {
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE] }],
      optionalServices: [SERVICE],
    });
    this.name = this.device.name || 'Muse';
    this.device.addEventListener('gattserverdisconnected', () => {
      if (!this.intentional) this.onDisconnect();
    });
    await this.#open();
  }

  async reconnect() {
    await this.#open();
  }

  async #open() {
    const gatt = await this.device.gatt.connect();
    const svc = await gatt.getPrimaryService(SERVICE);
    this.control = await svc.getCharacteristic(CONTROL);
    this.chars = [];

    const listen = async (id, fn) => {
      const c = await svc.getCharacteristic(id);
      c.addEventListener('characteristicvaluechanged', (e) => fn(e.target.value));
      await c.startNotifications();
      this.chars.push(c);
    };

    for (let ch = 0; ch < 4; ch++) {
      await listen(EEG[ch], (v) => this.onPacket({ kind: 'eeg', ch, seq: v.getUint16(0), samples: decode12(v) }));
    }
    for (let ch = 0; ch < 3; ch++) {
      await listen(PPG[ch], (v) => this.onPacket({ kind: 'ppg', ch, seq: v.getUint16(0), samples: decode24(v) }));
    }
    await listen(ACCEL, (v) => this.onPacket({ kind: 'accel', seq: v.getUint16(0), xyz: decodeImu(v, 0.0000610352) }));
    await listen(GYRO, (v) => this.onPacket({ kind: 'gyro', seq: v.getUint16(0), xyz: decodeImu(v, 0.0074768) }));
    await listen(TELEMETRY, (v) => this.onTelemetry({ battery: v.getUint16(2) / 512 }));

    await this.#send('h');
    await this.#send('p50'); // preset with PPG
    await this.#send('s');
    await this.#send('d');
  }

  #send(cmd) {
    return this.control.writeValue(encode(cmd)).then(() => wait(40));
  }

  disconnect() {
    this.intentional = true;
    try { this.device?.gatt?.disconnect(); } catch { /* already gone */ }
  }
}

function decode12(view) {
  const out = [];
  for (let i = 2; i + 2 < view.byteLength && out.length < 12; i += 3) {
    const a = view.getUint8(i), b = view.getUint8(i + 1), c = view.getUint8(i + 2);
    out.push(((a << 4) | (b >> 4)) - 0x800, (((b & 0xf) << 8) | c) - 0x800);
  }
  return out.map((n) => n * 0.48828125);
}

function decode24(view) {
  const out = [];
  for (let i = 2; i + 2 < view.byteLength && out.length < 6; i += 3) {
    out.push((view.getUint8(i) << 16) | (view.getUint8(i + 1) << 8) | view.getUint8(i + 2));
  }
  return out;
}

function decodeImu(view, scale) {
  const out = [];
  for (let s = 0; s < 3; s++) {
    const p = [];
    for (let a = 0; a < 3; a++) p.push(view.getInt16(2 + s * 6 + a * 2) * scale);
    out.push(p);
  }
  return out;
}

// Simulated headband: lets every page be used and demoed without hardware.
// Band gains for previewing how each state looks. These are illustrative, not measured data.
const SIM_STATES = {
  neutral: { d: 1, t: 1, a: 1, lo: 1, hi: 1, g: 1, mess: 0.15 },
  relax: { d: 0.8, t: 0.9, a: 2.6, lo: 0.6, hi: 0.5, g: 0.6, mess: 0 },
  focus: { d: 0.7, t: 1.9, a: 0.5, lo: 2.6, hi: 0.9, g: 1, mess: 0 },
  wander: { d: 2.0, t: 2.0, a: 0.7, lo: 0.7, hi: 0.8, g: 0.8, mess: 1.8 },
  anxious: { d: 0.9, t: 0.9, a: 0.6, lo: 1.1, hi: 4.2, g: 1.6, mess: 1 },
};

export class SimSource {
  name = '模擬資料';
  onPacket = () => {};
  onTelemetry = () => {};
  onDisconnect = () => {};
  #timers = [];
  #n = 0;
  #ppgN = 0;
  #imuSeq = 0;
  #seq = 0;
  #ppgSeq = 0;
  #blinkUntil = -1;
  #pink = [0, 0, 0, 0];
  #phaseHR = 0;
  #gain = { ...SIM_STATES.neutral };
  #target = SIM_STATES.neutral;
  #wob = [1, 1, 1, 1, 1, 1];

  setState(name) { this.#target = SIM_STATES[name] || SIM_STATES.neutral; }

  // Generates 40 s of neutral signal at once, so simulated sessions need no waiting.
  warmBaseline(analyzer) {
    const live = this.onPacket;
    this.onPacket = (p) => { if (p.kind === 'eeg') analyzer.push(p.ch, p.samples); };
    let owed = 0;
    const seq = this.#seq; // packet numbers must stay on the wall clock
    for (let i = 0; i < 420; i++) {
      for (owed += 256 / 10 / 12; owed >= 1; owed--) this.#eeg();
      const f = analyzer.frame();
      if (f && i > 20) analyzer.collectBaseline(f);
    }
    this.#seq = seq;
    this.onPacket = live;
  }

  async connect() {
    this.#timers.push(setInterval(() => this.#eeg(), (12 / 256) * 1000));
    this.#timers.push(setInterval(() => this.#ppg(), (6 / 64) * 1000));
    this.#timers.push(setInterval(() => this.#imu(), 58));
    this.onTelemetry({ battery: 87 });
  }

  disconnect() {
    this.#timers.forEach(clearInterval);
    this.#timers = [];
  }

  #eeg() {
    const packet = [[], [], [], []];
    for (let i = 0; i < 12; i++) {
      const t = this.#n++ / 256;
      if (Math.random() < 0.00012) this.#blinkUntil = t + 0.3;
      for (const k in this.#gain) this.#gain[k] += (this.#target[k] - this.#gain[k]) * 0.0006;
      const G = this.#gain;
      for (let w = 0; w < 6; w++) {
        this.#wob[w] += (1 - this.#wob[w]) * 0.0007 + (Math.random() - 0.5) * 0.09 * G.mess;
        this.#wob[w] = Math.max(0.05, Math.min(2.6, this.#wob[w]));
      }
      const W = this.#wob;
      for (let c = 0; c < 4; c++) {
        const m = (hz, off) => 0.55 + 0.45 * Math.sin(t * hz + c * 1.3 + off);
        this.#pink[c] = 0.98 * this.#pink[c] + 0.9 * (Math.random() - 0.5);
        let v = this.#pink[c] * 3 * (1 + G.mess * 1.5)
          + 16 * G.d * W[0] * m(0.27, 0) * Math.sin(2 * Math.PI * 2.3 * t + c)
          + 10 * G.t * W[1] * m(0.17, 2) * Math.sin(2 * Math.PI * 6 * t + c * 2)
          + 14 * G.a * W[2] * m(0.21, 4) * Math.sin(2 * Math.PI * 10.2 * t + c * 0.5)
          + 4 * G.lo * W[3] * m(0.23, 1) * Math.sin(2 * Math.PI * 16 * t + c * 3)
          + 3 * G.hi * W[4] * m(0.27, 5) * Math.sin(2 * Math.PI * 25 * t + c)
          + 2.4 * G.g * W[5] * m(0.31, 3) * Math.sin(2 * Math.PI * 38 * t + c);
        if (t < this.#blinkUntil && (c === 1 || c === 2)) v += 130;
        packet[c].push(v);
      }
    }
    const seq = this.#seq++;
    packet.forEach((samples, ch) => this.onPacket({ kind: 'eeg', ch, seq, samples }));
  }

  #ppg() {
    const rows = [[], [], []];
    for (let i = 0; i < 6; i++) {
      const dt = 1 / 64;
      const hr = 66 + 5 * Math.sin((this.#ppgN / 64) * 0.5);
      this.#phaseHR = (this.#phaseHR + (dt * hr) / 60) % 1;
      this.#ppgN++;
      const p = this.#phaseHR;
      const pulse = Math.exp(-((p - 0.2) ** 2) / 0.012) + 0.35 * Math.exp(-((p - 0.5) ** 2) / 0.02);
      rows[0].push(2000 + Math.random() * 20);
      rows[1].push(90000 + pulse * 3000 + Math.random() * 60);
      rows[2].push(60000 + pulse * 1800 + Math.random() * 60);
    }
    const seq = this.#ppgSeq++;
    rows.forEach((samples, ch) => this.onPacket({ kind: 'ppg', ch, seq, samples }));
  }

  #imu() {
    const seq = this.#imuSeq++;
    const r = () => (Math.random() - 0.5) * 0.02;
    const t = seq * 0.058;
    const sway = [0.12 * Math.sin(t * 0.5), 0.15 * Math.sin(t * 0.33 + 1)];
    this.onPacket({ kind: 'accel', seq, xyz: [0, 1, 2].map(() => [sway[0] + r(), sway[1] + r(), 1 + r()]) });
    this.onPacket({ kind: 'gyro', seq, xyz: [0, 1, 2].map(() => [r() * 40, r() * 40, r() * 40]) });
  }
}
