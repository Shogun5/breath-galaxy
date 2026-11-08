import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SENSORS, buildBrain, makeLabel } from './brain.js?v=10';

const HIST_W = 64, HIST_H = 20;
const FLAT_BG = 0x020308;
const BRAIN_CENTRE = new THREE.Vector3(0, 1.2, 0.7);
const SPIN_PER_BEAT = 0.07, SPIN_DECAY = 3, SPIN_IDLE = 0.012;

// Each arm is a live spectrogram. Along the arm: frequency (gamma inside, delta outside).
// Across the arm: time (leading edge is now, trailing edge is about 6 s ago).
const ARM_VS = /* glsl */`
uniform float uTime, uSpin, uRipple, uPx, uMotion, uHead, uBright, uWave, uFocus, uBrain;
uniform vec3 uElec[4];
uniform sampler2D uHist;
attribute float aArm, aT, aSeed, aG, aSize, aThick;
varying vec3 vC; varying float vA;
const float T = 64.0;
float bandAt(float col, float row){ return texture2D(uHist, vec2(col, (row + 0.5) / 20.0)).r; }
void main(){
  float t = aT;
  float b = (1.0 - t) * 4.0;
  float i = min(floor(b), 3.0);
  float f = b - i;
  float row = aArm * 5.0 + i;
  float w = aG * 0.5 + 0.5;
  float col = (uHead - 1.0 - w * (T - 3.0) + 0.5) / T;
  float e = mix(bandAt(col, row), bandAt(col, row + 1.0), f);
  vec4 h = texture2D(uHist, vec2(col, (row + 0.5) / 20.0));
  float chaos = h.g, flick = h.b;
  float width = (0.5 + t * 1.7) * mix(0.55, 1.6, chaos) * (1.0 - 0.25 * uFocus);
  float off = aG * width;
  float r = 0.5 + 5.7 * pow(t, 0.85) * (1.0 - 0.12 * uFocus) + off * 0.55;
  float a = aArm * 1.5707963 + t * 2.5 + off * 0.35 + (aSeed - 0.5) * chaos * chaos * 0.7 - uSpin * (1.2 - 0.33 * t);
  float rate = mix(16.0, 1.3, t);
  float jump = sin(uTime * rate * uMotion + aSeed * 6.283) * (0.02 + e * e * (0.3 + 0.45 * t));
  jump += sin(uTime * (3.0 + aSeed * 19.0) * uMotion + aSeed * 50.0) * chaos * chaos * 0.24;
  float d = mix(r, t * length(uElec[int(aArm)]), uBrain) - uRipple;
  float lit = smoothstep(0.9, -0.9, d) * uWave; // stars inside the breath light are gently lifted
  float spread = 0.35 * (r * 0.35 + 0.3);
  vec3 p = vec3(cos(a) * r, jump + aThick, sin(a) * r) + position * spread;
  if (uBrain > 0.001) {
    // Arm runs from the pineal gland (origin) straight to its sensor, twisting with the heartbeat.
    vec3 E = uElec[int(aArm)];
    float L = length(E) * (1.0 - 0.12 * uFocus);
    vec3 dir = normalize(E);
    vec3 u = normalize(cross(dir, vec3(0.13, 1.0, 0.21)));
    vec3 v = cross(dir, u);
    float tw = t * 3.2 - uSpin;
    vec3 across = u * cos(tw) + v * sin(tw);
    vec3 normal2 = cross(dir, across);
    float side = mod(aArm, 2.0) < 1.0 ? 1.0 : -1.0;
    vec3 q = dir * (0.15 + t * L) + u * sin(3.14159 * t) * 0.75 * side
      + across * off * (0.3 + t * 0.3) + normal2 * (jump * 0.6 + aThick * 0.25) + position * spread * 0.4;
    p = mix(p, q, uBrain);
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * (0.55 + 1.3 * e) * uPx / max(0.6, -mv.z), 1.0, 40.0);
  float k = pow(t, 0.55);
  vec3 core = vec3(1.0, 0.86, 0.68) * 0.95, mid = vec3(1.0, 0.54, 0.30) * 1.0, outer = vec3(0.31, 0.49, 1.0) * 1.3;
  vC = mix(mix(core, mid, smoothstep(0.0, 0.35, k)), outer, smoothstep(0.3, 0.85, k));
  vC *= 1.0 + lit * 0.22;
  vA = smoothstep(-0.1, 0.45, t) * (0.1 + 0.5 * e) * (0.75 + 0.25 * sin(aSeed * 40.0));
  vA *= 1.0 + flick * smoothstep(0.75, 0.1, t) * (0.55 + 0.55 * sin(uTime * (24.0 + aSeed * 30.0) * uMotion + aSeed * 90.0));
  vA *= 1.0 + 0.7 * uBrain;
  vA *= (1.0 - 0.45 * uFocus * smoothstep(0.35, 1.0, t)) * (1.0 + 0.4 * uFocus * smoothstep(0.5, 0.0, t));
}`;
const SOFT_FS = /* glsl */`
uniform float uBright;
varying vec3 vC; varying float vA;
void main(){
  float d = max(1.0 - length(gl_PointCoord - 0.5) * 2.0, 0.0);
  float s = pow(d, 2.2);
  gl_FragColor = vec4(vC * uBright, vA * s);
}`;
// Breath light: feathered rays that reach out past the galaxy on the inhale
// and draw back to the core, dimming, on the exhale. Always faces the viewer.
const BREATH_VS = /* glsl */`
uniform float uR;
varying vec2 vP;
void main(){
  vP = position.xy;
  vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  c.xy += position.xy * uR;
  gl_Position = projectionMatrix * c;
}`;
const BREATH_FS = /* glsl */`
uniform float uLevel, uWave, uTime;
varying vec2 vP;
void main(){
  float r = length(vP);
  if (r >= 1.0) discard;
  float a = atan(vP.y, vP.x);
  float n = 0.40 * sin(a * 7.0 + uTime * 0.05)
          + 0.32 * sin(a * 13.0 - uTime * 0.07 + 1.3)
          + 0.26 * sin(a * 23.0 + uTime * 0.04 + 2.1)
          + 0.18 * sin(a * 41.0 - uTime * 0.03 + 0.4);
  float rays = pow(smoothstep(-0.25, 1.1, n), 2.0);
  float feather = pow(1.0 - r, 3.0);
  float hollow = smoothstep(0.02, 0.2, r); // never adds light on top of the core
  float glow = rays * feather * hollow * mix(0.015, 0.13, uLevel) * uWave;
  gl_FragColor = vec4(vec3(1.0, 0.84, 0.68), glow);
}`;
const HEART_VS = /* glsl */`
uniform float uBeat, uPx, uTime;
attribute float aSeed, aSize;
varying vec3 vC; varying float vA;
void main(){
  float k = 1.0 + uBeat * 0.35;
  vec3 p = position * k;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uPx * (1.0 + uBeat * 0.35) / max(0.6, -mv.z), 1.0, 900.0);
  vC = mix(vec3(1.0, 0.33, 0.42), vec3(1.0, 0.86, 0.78), clamp(1.0 - length(position) * 3.0, 0.0, 1.0)) * 1.2;
  vA = aSize > 0.3 ? 0.035 + uBeat * 0.07 : 0.16 + uBeat * 0.22;
}`;

export class Galaxy {
  mode = 'flat'; // flat | sbs | xr
  sbsFormat = 'auto';
  moveInput = { x: 0, y: 0, z: 0 };
  onFrame = () => {};
  onXRAction = () => {};
  onXREnd = () => {};
  #vel = new THREE.Vector3();
  #yaw = 0; #pitch = 0;
  #beat = 0;
  #snapLatch = false;
  #spinVel = 0;
  #tiltTarget = [0, 0, 0];
  #tilt = [0, 0, 0];
  #baseTilt = 0;
  #head = 0;
  #pushedAt = 0;
  #slow = 0; #frames = 0; #frameT = 0;
  useBloom = true;
  view = 'galaxy';
  #brainTarget = 0;
  #labelAt = 0;
  #btn = {};

  constructor(canvas) {
    const coarse = matchMedia('(pointer:coarse)').matches;
    const quest = /OculusBrowser|Quest/i.test(navigator.userAgent);
    this.count = quest ? 40000 : coarse ? 24000 : 60000;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(FLAT_BG);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));
    this.renderer.xr.enabled = true;
    this.renderer.autoClear = true;
    this.scene = new THREE.Scene();
    this.world = new THREE.Group();
    this.world.rotation.order = 'YXZ';
    this.scene.add(this.world);
    this.rig = new THREE.Group();
    this.rig.rotation.order = 'YXZ';
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.05, 200);
    this.rig.add(this.camera);
    this.scene.add(this.rig);
    this.stereo = new THREE.StereoCamera();
    this.stereo.eyeSep = 0.9;
    this.shared = {
      uTime: { value: 0 },
      uRipple: { value: 3 },
      uPx: { value: 500 },
      uBright: { value: 0.55 },
      uSpin: { value: 0 },
    };
    this.motion = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.5 : 1;
    this.history = new Uint8Array(HIST_W * HIST_H * 4);
    for (let i = 0; i < this.history.length; i += 4) this.history.set([70, 70, 0, 255], i); // energy, chaos, flicker
    this.histTex = new THREE.DataTexture(this.history, HIST_W, HIST_H, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.histTex.magFilter = this.histTex.minFilter = THREE.LinearFilter;
    this.histTex.wrapS = THREE.RepeatWrapping;
    this.histTex.needsUpdate = true;
    this.energy = new Float32Array(20).fill(0.3);
    this.#build();
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.composer = new EffectComposer(this.renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }));
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.4, 0.55);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.#hud();
    this.resetView();
    addEventListener('resize', () => this.resize());
    this.resize();
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop((t, frame) => this.#loop(frame));
  }

  #build() {
    const n = this.count;
    const pos = new Float32Array(n * 3);
    const arm = new Float32Array(n), tt = new Float32Array(n), seed = new Float32Array(n), gw = new Float32Array(n), size = new Float32Array(n), thick = new Float32Array(n);
    const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    for (let i = 0; i < n; i++) {
      arm[i] = i % 4;
      tt[i] = Math.pow(Math.random(), 1.25);
      seed[i] = Math.random();
      gw[i] = gauss();
      const r = 0.5 + 5.7 * Math.pow(tt[i], 0.85);
      thick[i] = gauss() * (0.1 + 0.5 * Math.exp(-r * 0.8)); // thicker bulge near the centre
      const k = Math.pow(Math.random(), 2.5); // a few strays fill the space between arms
      pos.set([gauss() * k * 2.2, gauss() * k * 0.5, gauss() * k * 2.2], i * 3);
      size[i] = 0.025 + Math.random() ** 6 * 0.09;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aArm', new THREE.BufferAttribute(arm, 1));
    g.setAttribute('aT', new THREE.BufferAttribute(tt, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('aG', new THREE.BufferAttribute(gw, 1));
    g.setAttribute('aThick', new THREE.BufferAttribute(thick, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);
    const blend = { transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }; // always drawn over the brain surface
    this.armMat = new THREE.ShaderMaterial({
      ...blend, vertexShader: ARM_VS, fragmentShader: SOFT_FS,
      uniforms: { ...this.shared, uHist: { value: this.histTex }, uHead: { value: 0 }, uWave: { value: 0 }, uFocus: { value: 0 }, uBrain: { value: 0 }, uElec: { value: SENSORS.map((s) => s.pos) }, uMotion: { value: this.motion } },
    });
    this.world.add(new THREE.Points(g, this.armMat));

    this.breathMat = new THREE.ShaderMaterial({
      ...blend, depthTest: false, vertexShader: BREATH_VS, fragmentShader: BREATH_FS,
      uniforms: { uLevel: { value: 0 }, uR: { value: 1 }, uTime: this.shared.uTime, uWave: this.armMat.uniforms.uWave },
    });
    this.breathBall = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.breathMat);
    this.breathBall.frustumCulled = false;
    this.world.add(this.breathBall);

    const hn = 1800;
    const hp = new Float32Array((hn + 1) * 3), hs = new Float32Array(hn + 1), hseed = new Float32Array(hn + 1);
    for (let i = 0; i < hn; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(Math.random() ** 2 * 0.36);
      hp.set([v.x, v.y, v.z], i * 3);
      hs[i] = 0.018 + Math.random() * 0.03;
      hseed[i] = Math.random();
    }
    hs[hn] = 1.3; // soft glow
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.BufferAttribute(hp, 3));
    hg.setAttribute('aSize', new THREE.BufferAttribute(hs, 1));
    hg.setAttribute('aSeed', new THREE.BufferAttribute(hseed, 1));
    hg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 5);
    this.heartMat = new THREE.ShaderMaterial({
      ...blend, vertexShader: HEART_VS, fragmentShader: SOFT_FS,
      uniforms: { uBeat: { value: 0 }, uPx: this.shared.uPx, uTime: this.shared.uTime, uBright: this.shared.uBright },
    });
    this.world.add(new THREE.Points(hg, this.heartMat));

    const sn = 900, sp = new Float32Array(sn * 3);
    for (let i = 0; i < sn; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(40 + Math.random() * 40);
      sp.set([v.x, v.y, v.z], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0x8d8aa8, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.5, depthWrite: false }));
    this.scene.add(this.stars);
  }

  // In-world status line, for displays where a page overlay cannot be used.
  #hud() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 160;
    this.hudCtx = c.getContext('2d');
    this.hudTex = new THREE.CanvasTexture(c);
    this.hudTex.colorSpace = THREE.SRGBColorSpace;
    this.hud = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 0.25),
      new THREE.MeshBasicMaterial({ map: this.hudTex, transparent: true, depthTest: false, depthWrite: false }),
    );
    this.hud.position.set(0, -0.92, -2.2);
    this.hud.renderOrder = 10;
    this.hud.visible = false;
    this.camera.add(this.hud);
  }

  setHud(left, center, right) {
    const g = this.hudCtx;
    g.clearRect(0, 0, 1024, 160);
    g.fillStyle = '#EDE9F7';
    g.textBaseline = 'middle';
    g.font = '300 48px "Noto Sans TC", sans-serif';
    g.textAlign = 'left'; g.fillText(left, 20, 80);
    g.textAlign = 'right'; g.fillText(right, 1004, 80);
    g.font = '500 76px "Noto Sans TC", sans-serif';
    g.textAlign = 'center'; g.fillStyle = '#FF8A78'; g.fillText(center, 512, 80);
    this.hudTex.needsUpdate = true;
  }

  resetView() {
    this.#vel.set(0, 0, 0);
    const brain = this.view === 'brain';
    if (this.mode === 'xr') {
      this.rig.position.set(0, brain ? 0.6 : 1.2, brain ? -11 : 9.5);
      this.rig.rotation.set(0, brain ? Math.PI : 0, 0);
    } else {
      const narrow = this.camera.aspect < 0.8 ? 0.6 : 1;
      this.labels?.forEach((l) => l.scale.set(0.3 * narrow, 0.094 * narrow, 1));
      const fit = brain ? Math.min(1.8, Math.max(1, 1 / this.camera.aspect)) : 1; // narrow screens step back so every sensor stays in view
      const [x, y, z] = (brain ? [0, 8, -17.5] : [0, 7, 13]).map((v) => v * fit);
      if (brain) this.rig.position.set(x, y, z).add(BRAIN_CENTRE);
      else this.rig.position.set(x, y, z);
      this.#yaw = Math.atan2(x, z);
      this.#pitch = Math.atan2(-y, Math.hypot(x, z));
      this.rig.rotation.set(this.#pitch, this.#yaw, 0);
    }
  }

  get #orbiting() { return this.view === 'brain' && this.mode !== 'xr'; }

  // Moves the camera around the middle of the brain, always looking at it.
  #orbit(dAz, dEl, zoom = 1) {
    const v = this.rig.position.clone().sub(BRAIN_CENTRE);
    const r = THREE.MathUtils.clamp(v.length() * zoom, 5, 45);
    const az = Math.atan2(v.x, v.z) + dAz;
    const el = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(v.y / v.length(), -1, 1)) + dEl, -1.45, 1.45);
    this.rig.position.set(Math.sin(az) * Math.cos(el) * r, Math.sin(el) * r, Math.cos(az) * Math.cos(el) * r).add(BRAIN_CENTRE);
    this.#yaw = az;
    this.#pitch = -el;
    this.rig.rotation.set(this.#pitch, this.#yaw, 0);
  }

  zoom(deltaY) { if (this.#orbiting) this.#orbit(0, 0, Math.exp(deltaY * 0.001)); }

  setView(view) {
    if (view === this.view) return;
    this.view = view;
    this.#brainTarget = view === 'brain' ? 1 : 0;
    if (view === 'brain' && !this.brain) this.#buildBrain();
    this.resetView();
  }

  #buildBrain() {
    const coarse = matchMedia('(pointer:coarse)').matches;
    this.brain = buildBrain(coarse || this.count === 40000 ? 'lo' : 'hi');
    this.brain.ready.catch((e) => console.warn('brain model failed to load', e));
    this.world.add(this.brain.group);
    this.labels = SENSORS.map((s) => {
      const tag = makeLabel(`${s.id} ${s.place}`);
      tag.position.copy(s.pos).multiplyScalar(1.22);
      tag.position.y += 0.5;
      this.world.add(tag);
      return tag;
    });
    this.markers = SENSORS.map((s) => {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffb7a8, transparent: true, depthWrite: false, depthTest: false }));
      dot.position.copy(s.pos);
      this.world.add(dot);
      return dot;
    });
  }

  #updateLabels() {
    const now = performance.now();
    if (!this.labels || now - this.#labelAt < 500) return;
    this.#labelAt = now;
    const names = ['δ', 'θ', 'α', 'β', 'γ'];
    const live = (this.waveTarget ?? 0) > 0;
    this.labels.forEach((tag, c) => {
      let best = 0;
      for (let b = 1; b < 5; b++) if (this.energy[c * 5 + b] > this.energy[c * 5 + best]) best = b;
      const v = this.energy[c * 5 + best];
      tag.userData.setText(!live ? '' : v < 0.55 ? '平穩' : `${names[best]} 偏強`);
    });
  }

  look(dx, dy) {
    if (this.#orbiting) { this.#orbit(-dx * 0.0055, dy * 0.0055); return; }
    this.#yaw -= dx * 0.0032;
    this.#pitch = Math.max(-1.45, Math.min(1.45, this.#pitch - dy * 0.0032));
    this.rig.rotation.set(this.#pitch, this.#yaw, 0);
  }

  setMode(mode, sbsFormat) {
    this.mode = mode;
    if (sbsFormat) this.sbsFormat = sbsFormat;
    const immersive = mode !== 'flat';
    this.renderer.setClearColor(immersive ? 0x000000 : FLAT_BG);
    this.#syncBright();
    this.stars.visible = mode !== 'sbs'; // on additive glasses, keep the room visible behind the galaxy
    this.hud.visible = immersive;
    this.resize();
  }

  setSession(active) { this.waveTarget = active ? 1 : 0; }
  #syncBright() { this.shared.uBright.value = this.mode === 'flat' && this.useBloom ? 0.55 : 0.62; }

  // Adds one time column to the spectrogram (about 10 per second).
  setEnergy(e, chaos, flick, focus = 0) {
    const now = performance.now();
    if (now - this.#pushedAt < 85) return;
    this.#pushedAt = now;
    this.energy.set(e);
    this.#head = (this.#head + 1) % HIST_W;
    this.armMat.uniforms.uFocus.value = focus;
    for (let i = 0; i < HIST_H; i++) {
      const c = Math.floor(i / 5), p = (i * HIST_W + this.#head) * 4;
      this.history[p] = Math.round(e[i] * 255);
      this.history[p + 1] = Math.round((chaos ? chaos[c] : 0.28) * 255);
      this.history[p + 2] = Math.round((flick ? flick[c] : 0) * 255);
    }
    this.histTex.needsUpdate = true;
  }

  // Pitch, roll and yaw in radians. In the brain view the model follows the head one to one.
  setTilt(x, z, y = 0) {
    const m = this.view === 'brain' ? 1 : this.motion;
    this.#tiltTarget = [x * m, z * m, y * m];
  }
  setBreath(radius, level = 0) {
    this.shared.uRipple.value = radius;
    this.breathMat.uniforms.uR.value = radius * 1.35;
    this.breathMat.uniforms.uLevel.value = level;
  }
  beat(strength = 1) {
    this.#beat = Math.max(this.#beat, strength);
    this.#spinVel += SPIN_PER_BEAT * SPIN_DECAY * this.motion; // one heartbeat turns the galaxy by a fixed angle
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    if (this.renderer.xr.isPresenting) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    if (this.mode === 'sbs') this.camera.aspect = this.#sbsFull() ? (w / 2) / h : w / h;
    this.camera.updateProjectionMatrix();
    this.shared.uPx.value = h * this.renderer.getPixelRatio() * 0.95;
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    this.composer?.setSize(w, h);
  }

  #sbsFull() {
    if (this.sbsFormat === 'full') return true;
    if (this.sbsFormat === 'half') return false;
    return innerWidth / innerHeight > 3;
  }

  async startXR() {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
    this.renderer.xr.setReferenceSpaceType('local-floor');
    this.renderer.xr.setFoveation(0.6);
    await this.renderer.xr.setSession(session);
    this.setMode('xr');
    this.#baseTilt = this.view === 'brain' ? 0 : 0.45;
    this.resetView();
    this.shared.uPx.value = 900;
    session.addEventListener('end', () => {
      this.#baseTilt = 0;
      this.setMode('flat');
      this.resetView();
      this.onXREnd();
    });
    return session;
  }

  endXR() { this.renderer.xr.getSession()?.end(); }

  #pollXR() {
    const session = this.renderer.xr.getSession();
    if (!session) return;
    this.moveInput.x = this.moveInput.y = this.moveInput.z = 0;
    for (const src of session.inputSources) {
      const gp = src.gamepad;
      if (!gp) continue;
      const ax = gp.axes[2] ?? 0, ay = gp.axes[3] ?? 0;
      const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
      if (src.handedness === 'left') {
        this.moveInput.x = dz(ax); this.moveInput.z = dz(ay);
      } else if (src.handedness === 'right') {
        this.moveInput.y = -dz(ay);
        if (Math.abs(ax) > 0.7 && !this.#snapLatch) {
          this.#snapLatch = true;
          this.rig.rotation.y -= Math.sign(ax) * (Math.PI / 6);
        } else if (Math.abs(ax) < 0.3) this.#snapLatch = false;
        this.#edge('mark', gp.buttons[0]?.pressed);
        this.#edge('pause', gp.buttons[4]?.pressed);
        this.#edge('reset', gp.buttons[5]?.pressed);
      }
    }
  }

  #edge(name, on) {
    if (on && !this.#btn[name]) {
      if (name === 'reset') this.resetView(); else this.onXRAction(name);
    }
    this.#btn[name] = !!on;
  }

  #applyMove(dt) {
    const m = this.moveInput;
    if (this.#orbiting) {
      if (m.x || m.y || m.z) this.#orbit(m.x * dt * 1.1, m.y * dt * 0.9, Math.exp(m.z * dt * 0.9));
      return;
    }
    const cam = this.renderer.xr.isPresenting ? this.renderer.xr.getCamera() : this.camera;
    const q = cam.getWorldQuaternion(new THREE.Quaternion());
    const want = new THREE.Vector3(m.x, 0, m.z).applyQuaternion(q);
    want.y += m.y;
    want.multiplyScalar(2.6);
    this.#vel.lerp(want, Math.min(1, dt * 3.5));
    this.rig.position.addScaledVector(this.#vel, dt);
    if (this.rig.position.length() > 45) this.rig.position.setLength(45);
  }

  #loop() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.shared.uTime.value += dt;
    this.shared.uSpin.value += (SPIN_IDLE * this.motion + this.#spinVel) * dt;
    this.#spinVel *= Math.exp(-dt * SPIN_DECAY);
    this.armMat.uniforms.uHead.value = this.#head + Math.min(1, (performance.now() - this.#pushedAt) / 100);
    const tiltRate = Math.min(1, dt * (this.view === 'brain' ? 7 : 3));
    for (let i = 0; i < 3; i++) this.#tilt[i] += (this.#tiltTarget[i] - this.#tilt[i]) * tiltRate;
    this.world.rotation.x = this.#baseTilt + this.#tilt[0];
    this.world.rotation.z = this.#tilt[1];
    this.world.rotation.y = this.#tilt[2];
    const wave = this.armMat.uniforms.uWave;
    wave.value += ((this.waveTarget ?? 0) - wave.value) * Math.min(1, dt * 1.5);
    const bu = this.armMat.uniforms.uBrain;
    bu.value += (this.#brainTarget - bu.value) * Math.min(1, dt * 2.5);
    if (this.brain) {
      this.brain.material.uniforms.uFade.value = bu.value;
      const show = bu.value > 0.5;
      this.brain.group.visible = bu.value > 0.01;
      this.labels.forEach((l) => { l.visible = show; });
      this.markers.forEach((m) => { m.visible = show; });
      this.#updateLabels();
    }
    this.#watchSpeed(dt);
    this.#beat *= Math.exp(-dt * 5.5);
    this.heartMat.uniforms.uBeat.value = this.#beat;
    this.#pollXR();
    this.#applyMove(dt);
    this.onFrame(dt);
    const r = this.renderer;
    if (this.mode === 'sbs' && !r.xr.isPresenting) {
      const w = innerWidth, h = innerHeight;
      this.scene.updateMatrixWorld();
      this.camera.updateWorldMatrix(true, false);
      this.stereo.aspect = 1;
      this.camera.focus = Math.max(3, this.rig.position.length()); // galaxy centre sits at screen depth
      this.stereo.update(this.camera);
      r.setScissorTest(true);
      r.setScissor(0, 0, w / 2, h); r.setViewport(0, 0, w / 2, h);
      r.render(this.scene, this.stereo.cameraL);
      r.setScissor(w / 2, 0, w / 2, h); r.setViewport(w / 2, 0, w / 2, h);
      r.render(this.scene, this.stereo.cameraR);
      r.setScissorTest(false);
    } else if (this.mode === 'flat' && this.useBloom && !r.xr.isPresenting) {
      this.composer.render(dt);
    } else {
      r.render(this.scene, this.camera);
    }
  }

  // Bloom is the costliest step; a phone that cannot hold the frame rate drops it.
  #watchSpeed(dt) {
    if (!this.useBloom || this.mode !== 'flat' || document.hidden) return;
    this.#frameT += dt; this.#frames++;
    if (this.#frameT < 2) return;
    const fps = this.#frames / this.#frameT;
    this.#frameT = 0; this.#frames = 0;
    this.#slow = fps < 26 ? this.#slow + 1 : 0;
    if (this.#slow >= 3) { this.useBloom = false; this.#syncBright(); }
  }
}
