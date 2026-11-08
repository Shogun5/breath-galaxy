import * as THREE from 'three';

const ARM_VS = /* glsl */`
uniform float uTime, uE[20], uRipple, uPx, uMotion;
attribute float aArm, aT, aSeed, aOff, aSize;
varying vec3 vC; varying float vA;
void main(){
  float t = aT;
  float b = (1.0 - t) * 4.0;
  int i = int(min(floor(b), 3.0));
  float f = b - float(i);
  int ch = int(aArm);
  float e = mix(uE[ch*5+i], uE[ch*5+i+1], f);
  float r = 0.5 + 5.7 * pow(t, 0.85) + aOff * 0.55;
  float a = aArm * 1.5707963 + t * 2.5 + aOff * 0.35 + uTime * 0.018 * (1.25 - t);
  float rate = mix(16.0, 1.3, t);
  float jump = sin(uTime * rate * uMotion + aSeed * 6.283) * (0.03 + e * e * (0.34 + 0.5 * t));
  float d = r - uRipple;
  float ring = exp(-d * d * 3.0);
  vec3 p = vec3(cos(a) * r, jump + aOff * 0.12 + ring * 0.14, sin(a) * r);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * (0.55 + 1.5 * e) * uPx / max(0.6, -mv.z), 1.0, 26.0);
  vec3 outer = vec3(0.26, 0.17, 0.78), mid = vec3(0.55, 0.36, 0.96), inner = vec3(0.88, 0.82, 1.0);
  vC = t > 0.5 ? mix(mid, outer, (t - 0.5) * 2.0) : mix(inner, mid, t * 2.0);
  vC += vec3(1.0, 0.45, 0.35) * ring * 0.45;
  vA = (0.14 + 0.55 * e) * (0.75 + 0.25 * sin(aSeed * 40.0));
}`;
const SOFT_FS = /* glsl */`
varying vec3 vC; varying float vA;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float s = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vC, vA * s * s);
}`;
const RING_VS = /* glsl */`
uniform float uRipple, uDir, uPx, uShow;
attribute float aAng, aEcho;
varying vec3 vC; varying float vA;
void main(){
  float r = max(0.05, uRipple - uDir * aEcho * 0.42);
  vec4 mv = modelViewMatrix * vec4(cos(aAng) * r, 0.05, sin(aAng) * r, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp((0.05 - aEcho * 0.01) * uPx / max(0.6, -mv.z), 1.0, 9.0);
  vC = vec3(1.0, 0.45, 0.36);
  vA = uShow * (0.85 - aEcho * 0.26);
}`;
const HEART_VS = /* glsl */`
uniform float uBeat, uPx, uTime;
attribute float aSeed, aSize;
varying vec3 vC; varying float vA;
void main(){
  float k = 1.0 + uBeat * 0.6;
  vec3 p = position * k;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uPx * (1.0 + uBeat) / max(0.6, -mv.z), 1.0, 900.0);
  vC = mix(vec3(1.0, 0.33, 0.42), vec3(1.0, 0.86, 0.78), clamp(1.0 - length(position) * 3.0, 0.0, 1.0));
  vA = aSize > 0.3 ? 0.16 + uBeat * 0.5 : 0.42 + uBeat * 0.5;
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
  #btn = {};

  constructor(canvas) {
    const coarse = matchMedia('(pointer:coarse)').matches;
    const quest = /OculusBrowser|Quest/i.test(navigator.userAgent);
    this.count = quest ? 60000 : coarse ? 36000 : 100000;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x0b0d10);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));
    this.renderer.xr.enabled = true;
    this.renderer.autoClear = true;
    this.scene = new THREE.Scene();
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.rig = new THREE.Group();
    this.rig.rotation.order = 'YXZ';
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.05, 200);
    this.rig.add(this.camera);
    this.scene.add(this.rig);
    this.stereo = new THREE.StereoCamera();
    this.stereo.eyeSep = 0.14;
    this.shared = {
      uTime: { value: 0 },
      uRipple: { value: 3 },
      uPx: { value: 500 },
    };
    this.motion = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.25 : 1;
    this.#build();
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
    const arm = new Float32Array(n), tt = new Float32Array(n), seed = new Float32Array(n), off = new Float32Array(n), size = new Float32Array(n);
    const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    for (let i = 0; i < n; i++) {
      arm[i] = i % 4;
      tt[i] = Math.pow(Math.random(), 0.8);
      seed[i] = Math.random();
      off[i] = gauss() * (0.5 + tt[i] * 1.7);
      size[i] = 0.018 + Math.random() ** 3 * 0.05;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aArm', new THREE.BufferAttribute(arm, 1));
    g.setAttribute('aT', new THREE.BufferAttribute(tt, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('aOff', new THREE.BufferAttribute(off, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);
    const blend = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
    this.armMat = new THREE.ShaderMaterial({
      ...blend, vertexShader: ARM_VS, fragmentShader: SOFT_FS,
      uniforms: { ...this.shared, uE: { value: new Float32Array(20).fill(0.3) }, uMotion: { value: this.motion } },
    });
    this.world.add(new THREE.Points(g, this.armMat));

    const rn = 2160;
    const ang = new Float32Array(rn), echo = new Float32Array(rn);
    for (let i = 0; i < rn; i++) { ang[i] = (i / 720) * Math.PI * 2; echo[i] = Math.floor(i / 720); }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rn * 3), 3));
    rg.setAttribute('aAng', new THREE.BufferAttribute(ang, 1));
    rg.setAttribute('aEcho', new THREE.BufferAttribute(echo, 1));
    rg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);
    this.ringMat = new THREE.ShaderMaterial({
      ...blend, vertexShader: RING_VS, fragmentShader: SOFT_FS,
      uniforms: { uRipple: this.shared.uRipple, uPx: this.shared.uPx, uDir: { value: 1 }, uShow: { value: 0 } },
    });
    this.world.add(new THREE.Points(rg, this.ringMat));

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
      uniforms: { uBeat: { value: 0 }, uPx: this.shared.uPx, uTime: this.shared.uTime },
    });
    this.world.add(new THREE.Points(hg, this.heartMat));

    const sn = 2600, sp = new Float32Array(sn * 3);
    for (let i = 0; i < sn; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(40 + Math.random() * 40);
      sp.set([v.x, v.y, v.z], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0x8d8aa8, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.65, depthWrite: false }));
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
    if (this.mode === 'xr') {
      this.rig.position.set(0, 1.2, 9.5);
      this.rig.rotation.set(0, 0, 0);
    } else {
      this.rig.position.set(0, 7, 13);
      this.#yaw = 0;
      this.#pitch = Math.atan2(-7, 13);
      this.rig.rotation.set(this.#pitch, 0, 0);
    }
  }

  look(dx, dy) {
    this.#yaw -= dx * 0.0032;
    this.#pitch = Math.max(-1.45, Math.min(1.45, this.#pitch - dy * 0.0032));
    this.rig.rotation.set(this.#pitch, this.#yaw, 0);
  }

  setMode(mode, sbsFormat) {
    this.mode = mode;
    if (sbsFormat) this.sbsFormat = sbsFormat;
    const immersive = mode !== 'flat';
    this.renderer.setClearColor(immersive ? 0x000000 : 0x0b0d10);
    this.stars.visible = mode !== 'sbs'; // on additive glasses, keep the room visible behind the galaxy
    this.hud.visible = immersive;
    this.resize();
  }

  setSession(active) { this.ringMat.uniforms.uShow.value = active ? 1 : 0; }
  setEnergy(e) { this.armMat.uniforms.uE.value.set(e); }
  setBreath(radius, dir) { this.shared.uRipple.value = radius; this.ringMat.uniforms.uDir.value = dir; }
  beat(strength = 1) { this.#beat = Math.max(this.#beat, strength); }

  resize() {
    const w = innerWidth, h = innerHeight;
    if (this.renderer.xr.isPresenting) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    if (this.mode === 'sbs') this.camera.aspect = this.#sbsFull() ? (w / 2) / h : w / h;
    this.camera.updateProjectionMatrix();
    this.shared.uPx.value = h * this.renderer.getPixelRatio() * 0.95;
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
    this.world.rotation.x = 0.45;
    this.resetView();
    this.shared.uPx.value = 900;
    session.addEventListener('end', () => {
      this.world.rotation.x = 0;
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
    const cam = this.renderer.xr.isPresenting ? this.renderer.xr.getCamera() : this.camera;
    const q = cam.getWorldQuaternion(new THREE.Quaternion());
    const want = new THREE.Vector3(m.x, 0, m.z).applyQuaternion(q);
    want.y += m.y;
    want.multiplyScalar(2.6);
    this.#vel.lerp(want, Math.min(1, dt * 3.5));
    this.rig.position.addScaledVector(this.#vel, dt);
    if (this.rig.position.length() > 18) this.rig.position.setLength(18);
  }

  #loop() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.shared.uTime.value += dt;
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
      this.stereo.update(this.camera);
      r.setScissorTest(true);
      r.setScissor(0, 0, w / 2, h); r.setViewport(0, 0, w / 2, h);
      r.render(this.scene, this.stereo.cameraL);
      r.setScissor(w / 2, 0, w / 2, h); r.setViewport(w / 2, 0, w / 2, h);
      r.render(this.scene, this.stereo.cameraR);
      r.setScissorTest(false);
    } else {
      r.render(this.scene, this.camera);
    }
  }
}
