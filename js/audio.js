// Generated ambient music locked to the breath cycle, with a heartbeat layer.

const SCALE = [0, 3, 5, 7, 10, 12, 15, 17];
const ROOT = 55 * 2 ** (5 / 12); // D2-ish

export class Soundscape {
  ctx = null;
  #next = 0; #step = 0; #cycle = 10;

  start({ music, heart }) {
    this.music = music; this.heartOn = heart;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.8;
    this.master.connect(c.destination);
    const rev = c.createConvolver();
    const len = c.sampleRate * 3.5, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    rev.buffer = ir;
    this.wet = c.createGain(); this.wet.gain.value = 0.55;
    this.wet.connect(rev); rev.connect(this.master);
    if (music) {
      this.pad = c.createGain(); this.pad.gain.value = 0.02;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
      this.padFilter = lp;
      this.pad.connect(lp); lp.connect(this.master); lp.connect(this.wet);
      [1, 1.5, 2, 2.4].forEach((r, i) => {
        const o = c.createOscillator();
        o.type = i % 2 ? 'triangle' : 'sine';
        o.frequency.value = ROOT * r; o.detune.value = (i - 1.5) * 5;
        o.connect(this.pad); o.start();
      });
    }
    this.#next = c.currentTime + 0.1;
  }

  // Call every frame: sets the pad swell and schedules notes on a grid of 8 per breath.
  update(cycleSec, inhale, p, running) {
    if (!this.ctx) return;
    this.#cycle = cycleSec;
    const c = this.ctx;
    if (this.pad) {
      const swell = inhale ? 0.05 + 0.1 * p : 0.15 - 0.1 * p;
      this.pad.gain.setTargetAtTime(running ? swell : 0.02, c.currentTime, 0.12);
      this.padFilter.frequency.setTargetAtTime(300 + swell * 3000, c.currentTime, 0.2);
    }
    if (!this.music || !running) { this.#next = Math.max(this.#next, c.currentTime); return; }
    while (this.#next < c.currentTime + 0.2) {
      if (this.#step % 8 === 0 || Math.random() < 0.3) this.#pluck(this.#next, this.#step % 8 === 0);
      this.#next += this.#cycle / 8;
      this.#step++;
    }
  }

  #pluck(t, accent) {
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain();
    const n = accent ? 0 : SCALE[Math.floor(Math.random() * SCALE.length)];
    o.frequency.value = ROOT * 4 * 2 ** (n / 12);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(accent ? 0.09 : 0.05, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 2.2);
    o.connect(g); g.connect(this.master); g.connect(this.wet);
    o.start(t); o.stop(t + 2.4);
  }

  heartbeat() {
    if (!this.ctx || !this.heartOn) return;
    const c = this.ctx, now = c.currentTime;
    [[0, 0.32], [0.17, 0.2]].forEach(([d, v]) => {
      const t = now + d;
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(68, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.13);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(v, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.18);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 0.2);
    });
  }

  chime() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    [1, 1.5].forEach((r, i) => {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.value = 523 * r;
      g.gain.setValueAtTime(0, t + i * 0.25);
      g.gain.linearRampToValueAtTime(0.1, t + i * 0.25 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0005, t + i * 0.25 + 2.5);
      o.connect(g); g.connect(this.master); g.connect(this.wet);
      o.start(t + i * 0.25); o.stop(t + 3.2);
    });
  }

  stop() {
    this.ctx?.close();
    this.ctx = null; this.pad = null;
  }
}
