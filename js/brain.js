// Procedural translucent brain. Stylised, not anatomically exact.
// World origin is the pineal gland; +z is the nose, +y is up, +x is the person's left.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Scalp positions of the Muse sensors, relative to the pineal gland.
export const SENSORS = [
  { id: 'TP9', place: '左耳後', pos: new THREE.Vector3(4.9, -0.9, -1.9) },
  { id: 'AF7', place: '左前額', pos: new THREE.Vector3(3.0, 2.9, 6.0) },
  { id: 'AF8', place: '右前額', pos: new THREE.Vector3(-3.0, 2.9, 6.0) },
  { id: 'TP10', place: '右耳後', pos: new THREE.Vector3(-4.9, -0.9, -1.9) },
];
const OFFSET = new THREE.Vector3(0, 0.7, 0.9); // brain centre relative to the pineal gland

const perm = new Uint8Array(512);
{
  let s = 1234567;
  const a = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = a[i & 255];
}
const fade = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
function noise(x, y, z) {
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
  const u = fade(x - X), v = fade(y - Y), w = fade(z - Z);
  const h = (i, j, k) => perm[(perm[(perm[(X + i) & 255] + Y + j) & 255] + Z + k) & 255] / 255;
  return lerp(
    lerp(lerp(h(0, 0, 0), h(1, 0, 0), u), lerp(h(0, 1, 0), h(1, 1, 0), u), v),
    lerp(lerp(h(0, 0, 1), h(1, 0, 1), u), lerp(h(0, 1, 1), h(1, 1, 1), u), v),
    w,
  );
}
// Winding folds: 1 on top of a gyrus, 0 in a sulcus.
function gyri(x, y, z, f) {
  const wx = noise(x * 0.5 + 7, y * 0.5, z * 0.5) * 2.2;
  const wy = noise(x * 0.5, y * 0.5 + 11, z * 0.5) * 2.2;
  const wz = noise(x * 0.5, y * 0.5, z * 0.5 + 19) * 2.2;
  return 1 - Math.abs(2 * noise(x * f + wx, y * f + wy, z * f + wz) - 1);
}

const VS = /* glsl */`
attribute float aCrease;
varying vec3 vN, vV; varying float vC;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vC = aCrease;
  gl_Position = projectionMatrix * mv;
}`;
const FS = /* glsl */`
uniform float uFade;
varying vec3 vN, vV; varying float vC;
void main(){
  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  float ridge = smoothstep(0.35, 0.95, vC);
  float a = (0.006 + 0.018 * ridge + pow(f, 2.6) * 0.085 * mix(0.3, 1.0, ridge)) * uFade;
  gl_FragColor = vec4(mix(vec3(0.34, 0.42, 0.95), vec3(0.78, 0.82, 1.0), f), a);
}`;

function shaped(detail, shape) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);
  const p = g.attributes.position, crease = new Float32Array(p.count);
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    crease[i] = shape(v);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.setAttribute('aCrease', new THREE.BufferAttribute(crease, 1));
  g.computeVertexNormals();
  return g;
}

export function buildBrain(detail) {
  const material = new THREE.ShaderMaterial({
    vertexShader: VS, fragmentShader: FS, uniforms: { uFade: { value: 0 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  const group = new THREE.Group();

  const cerebrum = shaped(detail, (v) => {
    let x = v.x * 4.6, y = v.y * 4.0, z = v.z * 6.0;
    if (y < 0) { y *= 0.68; x *= 1.06; }
    y *= 1 - 0.16 * Math.max(z / 6, 0) ** 2;
    x *= 1 - 0.12 * Math.max(z / 6, 0) ** 2;
    const fissure = Math.exp(-((x / 0.42) ** 2)) * (y > -0.5 ? 1 : 0);
    y -= fissure * 1.25 * Math.max(y / 4 + 0.3, 0);
    x += Math.sign(x || 1) * 0.2;
    const r = gyri(x, y, z, 1.05) * 0.75 + gyri(x + 40, y, z, 2.1) * 0.25;
    const out = 1 + Math.pow(r, 2.2) * 0.1 - fissure * 0.06;
    v.set(x * out, y * out, z * out);
    return r;
  });
  group.add(new THREE.Mesh(cerebrum, material));

  const cerebellum = shaped(Math.max(14, Math.round(detail * 0.55)), (v) => {
    const r = 0.5 + 0.5 * Math.sin(v.y * 30 + v.z * 7 + noise(v.x * 3, v.y * 3, v.z * 3) * 2);
    const out = 1 + r * 0.035;
    v.set(v.x * 2.9 * out, v.y * 1.6 * out, v.z * 2.1 * out);
    v.add(new THREE.Vector3(0, -2.7, -4.4));
    return r;
  });
  group.add(new THREE.Mesh(cerebellum, material));

  const stem = new THREE.CylinderGeometry(0.85, 0.55, 3.8, 24, 1, true);
  stem.rotateX(0.22);
  stem.translate(0, -4.2, -2.1);
  stem.setAttribute('aCrease', new THREE.BufferAttribute(new Float32Array(stem.attributes.position.count).fill(0.7), 1));
  group.add(new THREE.Mesh(stem, material));

  group.position.copy(OFFSET);
  return { group, material };
}

// A two-line tag that faces the viewer, usable in every display mode.
export function makeLabel(title) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false }));
  sprite.scale.set(0.3, 0.094, 1);
  sprite.renderOrder = 8;
  const g = c.getContext('2d');
  let last = null;
  sprite.userData.setText = (line2) => {
    if (line2 === last) return;
    last = line2;
    g.clearRect(0, 0, 512, 160);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = '#020308'; g.shadowBlur = 14;
    g.fillStyle = '#EDE9F7';
    g.font = '500 54px "Noto Sans TC", sans-serif';
    g.fillText(title, 256, 52);
    g.fillStyle = '#FFB7A8';
    g.font = '300 46px "Noto Sans TC", sans-serif';
    g.fillText(line2, 256, 118);
    tex.needsUpdate = true;
  };
  sprite.userData.setText('');
  return sprite;
}
