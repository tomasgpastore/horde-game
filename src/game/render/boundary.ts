import * as THREE from 'three';
import type { ArenaDef } from '@shared/types';
/** Arena boundary: ring of tall jagged cliffs + a dark wall skirt + a dark far-floor, so the player never sees the void.
 *  Static geometry, one InstancedMesh + 2 meshes. Deterministic layout (seeded by index). */
export function buildBoundary(scene: THREE.Scene, def: ArenaDef): void {
  const R = def.radius, fog = new THREE.Color(def.palette.fog), dark = fog.clone().multiplyScalar(0.55);
  // World's huge outer ring floor is the flat grey 'void': make it dark and unfogged
  scene.traverse(o => { const m = o as THREE.Mesh; const gp = (m.geometry as THREE.RingGeometry | undefined)?.parameters as { outerRadius?: number } | undefined;
    if (m.isMesh && gp?.outerRadius && gp.outerRadius > R + 20) { const mat = m.material as THREE.MeshLambertMaterial; mat.color.multiplyScalar(0.3); mat.fog = false; } });
  // far floor beyond the wall: dark, so anything seen past the cliffs reads as deep shadow instead of flat sky colour
  const far = new THREE.Mesh(new THREE.CircleGeometry(R + 160, 48), new THREE.MeshBasicMaterial({ color: dark.clone().multiplyScalar(0.5), fog: false })); far.rotation.x = -Math.PI / 2; far.position.y = -0.08; scene.add(far);
  // wall skirt just outside the playable edge (seen from inside)
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R + 2.6, R + 2.2, 14, 64, 1, true), new THREE.MeshBasicMaterial({ color: dark.clone().multiplyScalar(0.8), side: THREE.BackSide, fog: false })); wall.position.y = 6; scene.add(wall);
  // jagged cliff teeth
  const n = Math.round(R * 4), g = new THREE.DodecahedronGeometry(1, 0); g.translate(0, 0.6, 0);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), im = new THREE.InstancedMesh(g, mat, n), o = new THREE.Object3D(), c = new THREE.Color();
  const h = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + (h(i) - 0.5) * 0.05, r = R + 1.4 + h(i + 99) * 3.2, w = 2.2 + h(i + 7) * 2.6, ht = 5 + h(i + 31) * 9;
    o.position.set(Math.cos(a) * r, -0.5, Math.sin(a) * r); o.rotation.set((h(i + 5) - 0.5) * 0.4, h(i + 13) * 6.28, (h(i + 17) - 0.5) * 0.4); o.scale.set(w, ht, w); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
    c.copy(dark).lerp(new THREE.Color(def.palette.ground), 0.35 + h(i + 3) * 0.3); im.setColorAt(i, c);
  }
  im.frustumCulled = false; im.userData.noHeightCap = true; scene.add(im); // tall on purpose; still fades when it would hide the hero
}
