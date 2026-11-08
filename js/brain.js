// Translucent brain from a scanned model (see credits in the guide page).
// World origin is the pineal gland; +z is the nose, +y is up, +x is the person's left. 1 unit = 15 mm.
import * as THREE from 'three';

// Approximate scalp positions of the Muse sensors, relative to the pineal gland.
export const SENSORS = [
  { id: 'TP9', place: '左耳後', pos: new THREE.Vector3(4.9, -0.5, -1.0) },
  { id: 'AF7', place: '左前額', pos: new THREE.Vector3(3.0, 2.1, 5.8) },
  { id: 'AF8', place: '右前額', pos: new THREE.Vector3(-3.0, 2.1, 5.8) },
  { id: 'TP10', place: '右耳後', pos: new THREE.Vector3(-4.9, -0.5, -1.0) },
];

const VS = /* glsl */`
varying vec3 vN, vV;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const FS = /* glsl */`
uniform float uFade;
varying vec3 vN, vV;
void main(){
  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  float a = (0.03 + pow(f, 1.6) * 0.34) * uFade;
  gl_FragColor = vec4(mix(vec3(0.34, 0.42, 0.95), vec3(0.78, 0.82, 1.0), f), a);
}`;

// quality: 'hi' or 'lo'. The group is returned at once and fills in when the mesh arrives.
export function buildBrain(quality) {
  const material = new THREE.ShaderMaterial({
    vertexShader: VS, fragmentShader: FS, uniforms: { uFade: { value: 0 } },
    transparent: true, depthWrite: false, side: THREE.FrontSide, blending: THREE.AdditiveBlending,
  });
  const group = new THREE.Group();
  const ready = fetch(`assets/brain-${quality}.bin?v=8`)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.arrayBuffer();
    })
    .then((buf) => {
      const [verts, idx] = new Uint32Array(buf, 0, 2);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf, 8, verts * 3), 3));
      g.setIndex(new THREE.BufferAttribute(new Uint32Array(buf, 8 + verts * 12, idx), 1));
      g.computeVertexNormals();
      // Depth-only pass first, so only the outer surface is shaded and the folds stay clean.
      const depth = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ colorWrite: false }));
      depth.renderOrder = -2;
      const mesh = new THREE.Mesh(g, material);
      mesh.renderOrder = -1;
      depth.frustumCulled = mesh.frustumCulled = false;
      group.add(depth, mesh);
    });
  return { group, material, ready };
}

// A two-line tag that faces the viewer, usable in every display mode.
export function makeLabel(firstTitle) {
  let title = firstTitle, line = '';
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
    last = line2; line = line2;
    g.clearRect(0, 0, 512, 160);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = '#020308'; g.shadowBlur = 14;
    g.fillStyle = '#EDE9F7';
    g.font = '500 44px "Noto Sans TC", sans-serif';
    g.fillText(title, 256, 52);
    g.fillStyle = '#FFB7A8';
    g.font = '300 42px "Noto Sans TC", sans-serif';
    g.fillText(line2, 256, 118);
    tex.needsUpdate = true;
  };
  sprite.userData.setTitle = (t) => { title = t; last = null; sprite.userData.setText(line); };
  sprite.userData.setText('');
  return sprite;
}
