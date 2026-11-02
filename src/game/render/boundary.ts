import * as THREE from 'three';
import type { ArenaDef } from '@shared/types';
/** Arena boundary: ring of tall jagged cliffs + a dark wall skirt + a dark far-floor, so the player never sees the void.
 *  Static geometry, one InstancedMesh + 2 meshes. Deterministic layout (seeded by index). */
export function buildBoundary(scene: THREE.Scene, def: ArenaDef): void {
  buildEdge(scene, def);
  const R = def.radius, fog = new THREE.Color(def.palette.fog), dark = fog.clone().multiplyScalar(0.55);
  // World's huge outer ring floor is the flat grey 'void': make it dark and unfogged
  scene.traverse(o => { const m = o as THREE.Mesh; const gp = (m.geometry as THREE.RingGeometry | undefined)?.parameters as { outerRadius?: number } | undefined;
    if (m.isMesh && gp?.outerRadius && gp.outerRadius > R + 20) { const mat = m.material as THREE.MeshLambertMaterial; mat.color.multiplyScalar(0.3); mat.fog = false; } });
  // wall skirt just outside the playable edge (seen from inside)
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R + 2.6, R + 2.2, 14, 64, 1, true), new THREE.MeshBasicMaterial({ color: dark.clone().multiplyScalar(0.8), side: THREE.BackSide, fog: false })); wall.position.y = 6; scene.add(wall);
  // jagged cliff teeth
  const n = Math.round(R * 4), g = new THREE.DodecahedronGeometry(1, 0); g.translate(0, 0.6, 0);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), im = new THREE.InstancedMesh(g, mat, n), o = new THREE.Object3D(), c = new THREE.Color();
  const h = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + (h(i) - 0.5) * 0.05, r = R + 1.4 + h(i + 99) * 3.2, w = 2.2 + h(i + 7) * 2.6, ht = (5 + h(i + 31) * 4) * (Math.sin(a) > 0 ? 1 - 0.7 * Math.sin(a) : 1); // camera sits at +z: keep the near-side wall low
    o.position.set(Math.cos(a) * r, -0.5, Math.sin(a) * r); o.rotation.set((h(i + 5) - 0.5) * 0.4, h(i + 13) * 6.28, (h(i + 17) - 0.5) * 0.4); o.scale.set(w, ht, w); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
    c.copy(dark).lerp(new THREE.Color(def.palette.ground), 0.35 + h(i + 3) * 0.3); im.setColorAt(i, c);
  }
  im.frustumCulled = false; scene.add(im);
}

const hash = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
/** CD edge spec: continuous dark columns with glowing accent cracks, fog wall, ground darkening, rising embers, no void. */
function buildEdge(scene: THREE.Scene, def: ArenaDef): void {
  const R = def.radius, accent = new THREE.Color(def.palette.accent), fogC = new THREE.Color(def.palette.fog), dark = new THREE.Color(def.palette.ground).multiplyScalar(0.18);
  // (2) fog and background: nothing visible outside the ring
  scene.background = fogC.clone(); if (scene.fog instanceof THREE.Fog) { scene.fog.color.copy(fogC); scene.fog.near = R - 14; scene.fog.far = R + 10; }
  // (1) continuous columns at radius R, height 6-10, jitter +-1.5
  const n = Math.round(R * 3.2), g = new THREE.CylinderGeometry(0.8, 1, 1, 6); g.translate(0, 0.5, 0);
  const cols = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), n);
  const cg = new THREE.BoxGeometry(0.1, 1, 0.1); cg.translate(0, 0.5, 0);
  const cm = new THREE.MeshBasicMaterial({ color: accent.clone().multiplyScalar(1.5), toneMapped: false });
  const cracks = new THREE.InstancedMesh(cg, cm, n * 2), o = new THREE.Object3D(), c = new THREE.Color(); let ci = 0;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + (hash(i) - 0.5) * 0.02, r = R + 1.3 + (hash(i + 5) - 0.5) * 3, w = 1.7 + hash(i + 9) * 0.9, ht = (6 + hash(i + 21) * 4) * (Math.sin(a) > 0 ? 1 - 0.45 * Math.sin(a) : 1); // lower on the camera (+z) side so it never hides the hero
    o.position.set(Math.cos(a) * r, -0.3, Math.sin(a) * r); o.rotation.set(0, hash(i + 3) * 6.28, 0); o.scale.set(w, ht, w); o.updateMatrix(); cols.setMatrixAt(i, o.matrix);
    c.copy(dark).multiplyScalar(0.8 + hash(i + 13) * 0.6); cols.setColorAt(i, c);
    for (let k = 0; k < 2; k++) { const ch = 2 + hash(i * 3 + k + 40) * (ht * 0.6), ra = r - w * (0.78 + 0.06 * k), aa = a + (hash(i + k * 7 + 60) - 0.5) * (w / r) * 0.9;
      o.position.set(Math.cos(aa) * ra, 0.3 + hash(i + k + 70) * (ht - ch) * 0.5, Math.sin(aa) * ra); o.rotation.set((hash(i + k) - 0.5) * 0.25, -aa, (hash(i + k + 2) - 0.5) * 0.3);
      o.scale.set(1, ch, 1); o.updateMatrix(); cracks.setMatrixAt(ci++, o.matrix); } }
  cracks.count = ci; cols.frustumCulled = cracks.frustumCulled = false; scene.add(cols, cracks);
  // (2) additive gradient cylinder at R-1: biome glow strongest at the base
  const cv = document.createElement('canvas'); cv.width = 4; cv.height = 64; const cx = cv.getContext('2d')!, gr = cx.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.35)'); cx.fillStyle = gr; cx.fillRect(0, 0, 4, 64);
  const gt = new THREE.CanvasTexture(cv), gm = new THREE.MeshBasicMaterial({ map: gt, color: accent.clone().multiplyScalar(0.7), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(R - 1, R - 1, 8, 64, 1, true), gm); glow.position.y = 4; scene.add(glow);
  // (3) ground darkens to #080a14 over the last 5u
  const fm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -1,
    uniforms: { uR: { value: R } }, vertexShader: 'varying float vR; void main(){ vR = length(position.xy); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uR; varying float vR; void main(){ float a = smoothstep(uR - 5.0, uR, vR) * 0.96; gl_FragColor = vec4(0.031, 0.039, 0.078, a); }' });
  const fade = new THREE.Mesh(new THREE.RingGeometry(R - 5.2, R + 0.4, 96, 6), fm); fade.rotation.x = -Math.PI / 2; fade.position.y = 0.035; scene.add(fade);
  // embers rising along the wall
  const E = 260, ep = new Float32Array(E * 3), es = new Float32Array(E * 2);
  for (let i = 0; i < E; i++) { const a = hash(i + 200) * 6.2832, r = R - 0.8 + hash(i + 300) * 2; ep[i * 3] = Math.cos(a) * r; ep[i * 3 + 1] = hash(i + 400) * 9; ep[i * 3 + 2] = Math.sin(a) * r; es[i * 2] = 0.8 + hash(i + 500) * 1.8; es[i * 2 + 1] = hash(i + 600) * 6.28; }
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(ep, 3));
  const sc = document.createElement('canvas'); sc.width = sc.height = 32; const sg = sc.getContext('2d')!, rg = sg.createRadialGradient(16, 16, 0, 16, 16, 16);
  rg.addColorStop(0, '#fff'); rg.addColorStop(1, 'rgba(255,255,255,0)'); sg.fillStyle = rg; sg.fillRect(0, 0, 32, 32);
  const pm = new THREE.PointsMaterial({ map: new THREE.CanvasTexture(sc), color: accent.clone().lerp(new THREE.Color(1, 1, 1), 0.2), size: 0.5, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const pts = new THREE.Points(eg, pm); pts.frustumCulled = false; let last = 0;
  pts.onBeforeRender = () => { const now = performance.now() / 1000, dt = Math.min(0.1, now - (last || now)); last = now; // render-side only
    for (let i = 0; i < E; i++) { let y = ep[i * 3 + 1] + es[i * 2] * dt; if (y > 9) y -= 9; ep[i * 3 + 1] = y; ep[i * 3] += Math.sin(now + es[i * 2 + 1]) * 0.15 * dt; }
    (eg.attributes.position as THREE.BufferAttribute).needsUpdate = true; };
  scene.add(pts);
}
