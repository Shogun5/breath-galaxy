// Signal processing: EEG band power, signal quality, baseline and PPG beats.

export const BANDS = [
  { key: 'delta', label: 'δ Delta', from: 1, to: 3 },
  { key: 'theta', label: 'θ Theta', from: 4, to: 7 },
  { key: 'alpha', label: 'α Alpha', from: 8, to: 12 },
  { key: 'beta', label: 'β Beta', from: 13, to: 29 },
  { key: 'gamma', label: 'γ Gamma', from: 30, to: 44 },
];

const N = 256;
const hann = Float64Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
const cosT = Float64Array.from({ length: N / 2 }, (_, i) => Math.cos((2 * Math.PI * i) / N));
const sinT = Float64Array.from({ length: N / 2 }, (_, i) => Math.sin((2 * Math.PI * i) / N));
const rev = Uint16Array.from({ length: N }, (_, i) => {
  let r = 0;
  for (let b = 0; b < 8; b++) if (i & (1 << b)) r |= 1 << (7 - b);
  return r;
});

export function powerSpectrum(input) {
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[rev[i]] = input[i];
  for (let size = 2; size <= N; size *= 2) {
    const half = size / 2, step = N / size;
    for (let s = 0; s < N; s += size) {
      for (let j = 0; j < half; j++) {
        const k = j * step, a = s + j, b = a + half;
        const tr = re[b] * cosT[k] + im[b] * sinT[k];
        const ti = im[b] * cosT[k] - re[b] * sinT[k];
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
      }
    }
  }
  const p = new Float64Array(N / 2);
  for (let i = 0; i < N / 2; i++) p[i] = (re[i] ** 2 + im[i] ** 2) / N;
  return p;
}

export class EegAnalyzer {
  buf = [0, 1, 2, 3].map(() => new Float64Array(N));
  pos = [0, 0, 0, 0];
  count = [0, 0, 0, 0];
  baseFrames = [];
  baseExt = [];
  totals = [[], [], [], []];
  chaos = new Float32Array(4).fill(0.3);
  flick = new Float32Array(4);
  focus = 0;
  baseline = null;
  energy = new Float32Array(20).fill(0.3);

  push(ch, samples) {
    for (const s of samples) {
      this.buf[ch][this.pos[ch]] = s;
      this.pos[ch] = (this.pos[ch] + 1) % N;
      this.count[ch]++;
    }
  }

  // One frame per call: log-power per band and quality per channel.
  frame() {
    if (this.count.some((c) => c < N)) return null;
    const log = [], quality = [], artifact = [], ext = [];
    for (let c = 0; c < 4; c++) {
      const x = new Float64Array(N);
      let mean = 0;
      for (let i = 0; i < N; i++) mean += (x[i] = this.buf[c][(this.pos[c] + i) % N]);
      mean /= N;
      let sq = 0, min = Infinity, max = -Infinity;
      const win = new Float64Array(N);
      for (let i = 0; i < N; i++) {
        const v = x[i] - mean;
        sq += v * v; min = Math.min(min, v); max = Math.max(max, v);
        win[i] = v * hann[i];
      }
      const std = Math.sqrt(sq / N), ptp = max - min;
      const ps = powerSpectrum(win);
      log.push(BANDS.map((b) => {
        let sum = 0;
        for (let k = b.from; k <= b.to; k++) sum += ps[k];
        return Math.log10(sum / (b.to - b.from + 1) + 1e-6);
      }));
      const bandLog = (from, to) => {
        let sum = 0;
        for (let k = from; k <= to; k++) sum += ps[k];
        return Math.log10(sum / (to - from + 1) + 1e-6);
      };
      let total = 0, H = 0;
      for (let k = 1; k <= 44; k++) total += ps[k];
      for (let k = 1; k <= 44; k++) { const p = ps[k] / (total + 1e-9); if (p > 0) H -= p * Math.log(p); }
      const level = log[c].reduce((a, v) => a + v, 0) / BANDS.length;
      const hist = this.totals[c];
      if (ptp <= 150) { hist.push(level); if (hist.length > 30) hist.shift(); }
      const m = hist.reduce((a, v) => a + v, 0) / Math.max(1, hist.length);
      const sd = Math.sqrt(hist.reduce((a, v) => a + (v - m) ** 2, 0) / Math.max(1, hist.length));
      ext.push({ lo: bandLog(13, 19), hi: bandLog(20, 30), H: H / Math.log(44), sd });
      artifact.push(ptp > 150);
      quality.push(std < 30 && ptp < 150 ? 'good' : std < 70 ? 'fair' : 'bad');
    }
    return { log, quality, artifact, ext };
  }

  collectBaseline(f) {
    if (f.artifact.every((a) => !a)) { this.baseFrames.push(f.log); this.baseExt.push(f.ext); }
  }

  finishBaseline() {
    const frames = this.baseFrames;
    this.baseline = [0, 1, 2, 3].map((c) => BANDS.map((_, b) => {
      const v = frames.map((f) => f[c][b]);
      const m = v.reduce((a, x) => a + x, 0) / Math.max(1, v.length);
      const sd = Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, v.length));
      return { m, sd: Math.max(sd, 0.05) };
    }));
    this.extBase = [0, 1, 2, 3].map((c) => Object.fromEntries(['lo', 'hi', 'H', 'sd'].map((k) => {
      const v = this.baseExt.map((f) => f[c][k]);
      const m = v.reduce((a, x) => a + x, 0) / Math.max(1, v.length);
      const sd = Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, v.length));
      return [k, { m, sd: Math.max(sd, k === 'H' ? 0.01 : k === 'sd' ? 0.06 : 0.03) }];
    })));
    return this.baseFrames.length;
  }

  // z-score against the person's own resting baseline, then a 0..1 display value.
  zscores(f) {
    return f.log.map((row, c) => row.map((v, b) => (v - this.baseline[c][b].m) / this.baseline[c][b].sd));
  }

  // How orderly each channel is, relative to this person's resting baseline.
  updateOrder(f, z) {
    const zOf = (c, k) => (f.ext[c][k] - this.extBase[c][k].m) / this.extBase[c][k].sd;
    const clamp = (v) => Math.min(1, Math.max(0, v));
    for (let c = 0; c < 4; c++) {
      if (f.artifact[c]) continue;
      const chaos = clamp(0.3 + 0.05 * zOf(c, 'H') + 0.3 * zOf(c, 'sd'));
      const flick = clamp(0.32 * (zOf(c, 'hi') - Math.max(zOf(c, 'lo'), 0) * 0.5) - 0.2);
      this.chaos[c] += (chaos - this.chaos[c]) * 0.14;
      this.flick[c] += (flick - this.flick[c]) * 0.2;
    }
    let focus = 0, n = 0;
    for (const c of [1, 2]) { // frontal channels
      if (f.artifact[c]) continue;
      focus += 0.65 * zOf(c, 'lo') + 0.3 * z[c][1] - 0.3 * z[c][2] - 0.5 * Math.max(z[c][0], 0);
      n++;
    }
    const steady = (1 - (this.chaos[1] + this.chaos[2]) / 2) * (1 - (this.flick[1] + this.flick[2]) / 2);
    if (n) this.focus += (clamp(((focus / n) * 0.5 - 0.1) * (0.5 + steady * 0.7)) - this.focus) * 0.1;
    return { chaos: this.chaos, flick: this.flick, focus: this.focus };
  }

  updateEnergy(f, z) {
    for (let c = 0; c < 4; c++) {
      for (let b = 0; b < 5; b++) {
        const target = f.artifact[c] ? 0.08 : Math.min(1, Math.max(0, 0.42 + 0.24 * z[c][b]));
        const i = c * 5 + b;
        this.energy[i] += (target - this.energy[i]) * 0.28;
      }
    }
    return this.energy;
  }
}

// Finds pulses in the infrared PPG channel and predicts the next beat, so the
// visual pulse does not lag behind by the detection delay.
export class BeatTracker {
  slow = null; fast = null;
  prev = 0; rising = false; peak = 0; peakT = 0;
  level = 0; lastBeat = -1e9;
  ibis = [];
  onBeat = () => {};

  push(value, tMs) {
    if (this.slow === null) { this.slow = value; this.fast = value; return; }
    this.slow += (value - this.slow) * 0.04;
    this.fast += (value - this.fast) * 0.3;
    const s = this.fast - this.slow;
    this.level = Math.max(this.level * 0.997, Math.abs(s));
    if (s > this.prev) {
      this.rising = true;
      this.peak = s; this.peakT = tMs;
    } else if (this.rising) {
      this.rising = false;
      if (this.peak > this.level * 0.5 && this.peakT - this.lastBeat > 340) {
        const ibi = this.peakT - this.lastBeat;
        this.lastBeat = this.peakT;
        const valid = ibi > 340 && ibi < 1800;
        if (valid) { this.ibis.push(ibi); if (this.ibis.length > 12) this.ibis.shift(); }
        this.onBeat(this.peakT, valid ? ibi : null);
      }
    }
    this.prev = s;
  }

  get ibi() {
    if (this.ibis.length < 3) return null;
    const a = [...this.ibis].sort((x, y) => x - y);
    return a[a.length >> 1];
  }

  get bpm() { return this.ibi ? 60000 / this.ibi : null; }
}

// Combines per-channel packets into rows and gives each sample a time.
export class Aligner {
  constructor(nCh, perPacket, fs, onRow) {
    Object.assign(this, { nCh, perPacket, fs, onRow });
    this.pending = new Map();
    this.reset();
  }

  reset() {
    this.flush();
    this.last = null; this.wrap = 0; this.epoch = null;
  }

  unwrap(seq) {
    if (this.last !== null && seq > this.last + 30000) return seq + this.wrap - 65536; // late packet from before a wrap
    if (this.last !== null && seq < this.last - 30000) this.wrap += 65536;
    this.last = seq;
    return seq + this.wrap;
  }

  add(ch, seq, samples) {
    if (samples.length !== this.perPacket) { this.reset(); this.perPacket = samples.length; } // Muse 2 and Athena pack differently
    const s = this.unwrap(seq);
    const ms = (this.perPacket / this.fs) * 1000;
    if (this.epoch === null) this.epoch = performance.now() - s * ms;
    let p = this.pending.get(s);
    if (!p) this.pending.set(s, (p = new Array(this.nCh).fill(null)));
    p[ch] = samples;
    if (p.every(Boolean)) this.#emit(s, p);
    if (this.pending.size > 8) {
      const oldest = Math.min(...this.pending.keys());
      this.#emit(oldest, this.pending.get(oldest));
    }
  }

  #emit(s, p) {
    this.pending.delete(s);
    const ms = (this.perPacket / this.fs) * 1000;
    const t0 = this.epoch + s * ms;
    for (let i = 0; i < this.perPacket; i++) {
      this.onRow(t0 + (i * 1000) / this.fs, p.map((c) => (c ? c[i] : null)));
    }
  }

  flush() {
    if (!this.pending) return;
    [...this.pending.keys()].sort((a, b) => a - b).forEach((k) => this.#emit(k, this.pending.get(k)));
  }
}

export function rmssd(ibis) {
  if (ibis.length < 3) return null;
  let sum = 0;
  for (let i = 1; i < ibis.length; i++) sum += (ibis[i] - ibis[i - 1]) ** 2;
  return Math.sqrt(sum / (ibis.length - 1));
}

// Names a likely state from band changes against the person's own resting baseline.
// Markers: relaxation = alpha up / beta down; focus = engagement index beta/(alpha+theta)
// (Pope et al.) with frontal theta; wandering or drowsy = theta/beta up; tension = high beta
// with an unsteady signal (weakest evidence, and muscle activity looks the same).
export const STATES = ['steady', 'relax', 'focus', 'wander', 'tense'];
export class StateEstimator {
  scores = { relax: 0, focus: 0, wander: 0, tense: 0 };
  state = 'steady';
  #candidate = 'steady';
  #since = 0;
  #clean = 1;

  update(z, f, order, now = performance.now()) {
    const ok = [0, 1, 2, 3].filter((c) => !f.artifact[c]);
    this.#clean += ((ok.length / 4) - this.#clean) * 0.1;
    if (!ok.length) return this.state;
    const m = [0, 1, 2, 3, 4].map((b) => ok.reduce((a, c) => a + z[c][b], 0) / ok.length);
    const [d, t, a, b, g] = m;
    const flick = ok.reduce((s, c) => s + order.flick[c], 0) / ok.length;
    const chaos = ok.reduce((s, c) => s + order.chaos[c], 0) / ok.length;
    const raw = {
      relax: a - 0.5 * b - flick,
      focus: (b - 0.5 * (a + t)) + 1.2 * order.focus - 1.5 * flick - 2 * Math.max(chaos - 0.45, 0),
      wander: (t - b) + 0.4 * d + 3 * (chaos - 0.4),
      tense: 3 * flick + 2 * (chaos - 0.4) + 0.3 * g,
    };
    for (const k in raw) this.scores[k] += (raw[k] - this.scores[k]) * 0.05;
    let best = 'steady', top = 0.8;
    for (const k in this.scores) if (this.scores[k] > top) { top = this.scores[k]; best = k; }
    if (this.#clean < 0.5) best = 'noisy';
    if (best !== this.#candidate) { this.#candidate = best; this.#since = now; }
    if (best !== this.state && now - this.#since > 3000) this.state = best; // hold 3 s before switching
    return this.state;
  }
}
