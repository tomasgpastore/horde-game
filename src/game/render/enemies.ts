import * as THREE from 'three';
import type { EnemyPool } from '@shared/types';
import { MAX_ENEMIES } from '@shared/types';
/** One InstancedMesh per enemy kind (distinct low-poly silhouettes + emissive accents). Index = ENEMIES table kind. Engine Engineer: replace geometries with models freely. */
interface Look { geo: THREE.BufferGeometry; color: number; emissive: number; scale: number; y: number; bob: number; spin: number }
const cone = (r: number, h: number, seg: number) => { const g = new THREE.ConeGeometry(r, h, seg); g.translate(0, h / 2, 0); return g; };
const LOOKS: Look[] = [
  { geo: cone(0.45, 1.1, 6), color: 0xe0602a, emissive: 0x401400, scale: 1, y: 0, bob: 0, spin: 0 },                 // 0 husk: orange cone
  { geo: new THREE.OctahedronGeometry(0.4), color: 0xd02ac0, emissive: 0x500a48, scale: 1, y: 0.9, bob: 0.2, spin: 3 }, // 1 wisp: floating magenta crystal
  { geo: new THREE.DodecahedronGeometry(0.7), color: 0x8fd13a, emissive: 0x1c3a08, scale: 1, y: 0.7, bob: 0, spin: 0 }, // 2 brute: lime boulder
  { geo: cone(0.28, 0.9, 4), color: 0xffb02a, emissive: 0x4a3000, scale: 1, y: 0, bob: 0, spin: 0 },                  // 3 skitter: slim amber spike
  { geo: new THREE.IcosahedronGeometry(1.0, 0), color: 0xb0309a, emissive: 0x3a0a30, scale: 1, y: 1.0, bob: 0.1, spin: 0 }, // 4 bloater: big magenta orb
  { geo: new THREE.BoxGeometry(1.0, 1.4, 0.6), color: 0x6ec0d8, emissive: 0x0a2a38, scale: 1, y: 0.7, bob: 0, spin: 0 },    // 5 shield knight: steel-blue slab
];
export const KIND_COLORS = LOOKS.map(l => l.color);
export class EnemyRenderer {
  meshes: THREE.InstancedMesh[]; private o = new THREE.Object3D(); private c = new THREE.Color();
  constructor(scene: THREE.Scene) {
    this.meshes = LOOKS.map(l => {
      const m = new THREE.InstancedMesh(l.geo, new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: l.emissive, flatShading: true }), MAX_ENEMIES);
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_ENEMIES * 3), 3);
      m.frustumCulled = false; m.castShadow = true; m.count = 0; scene.add(m); return m; });
  }
  update(e: EnemyPool, t: number) {
    const cnt = new Array(LOOKS.length).fill(0), o = this.o;
    for (let i = 0; i < e.count; i++) { if (!e.alive[i]) continue;
      const k = Math.min(e.kind[i], LOOKS.length - 1), l = LOOKS[k], m = this.meshes[k], n = cnt[k]++;
      o.position.set(e.x[i], l.y + (l.bob ? Math.sin(t * 3 + i) * l.bob : 0), e.z[i]); o.rotation.set(0, l.spin ? t * l.spin + i : e.facing[i], 0); o.scale.setScalar(l.scale); o.updateMatrix();
      m.setMatrixAt(n, o.matrix); this.c.setHex(e.hitFlash[i] > 0 ? 0xffffff : l.color); m.setColorAt(n, this.c); }
    for (let k = 0; k < LOOKS.length; k++) { const m = this.meshes[k]; m.count = cnt[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }
}
