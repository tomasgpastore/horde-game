import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { EnemyPool } from '@shared/types';
import { MAX_ENEMIES } from '@shared/types';

/** Procedural enemy meshes (Creative Director). Per kind: a dark Lambert BODY + an emissive GLOW InstancedMesh
 *  (eyes/cracks/cores) sharing one matrix, so bloom makes them pop on the dark floor. +Z forward.
 *  Kind index = ENEMIES table index: 0 husk, 1 wisp, 2 brute, 3 skitter, 4 bloater, 5 shield knight, 6 spitter, 7 wraith. */
type G = THREE.BufferGeometry;
interface Part { g: G; x?: number; y?: number; z?: number; rx?: number; ry?: number; rz?: number; sx?: number; sy?: number; sz?: number }
interface Look { body: number; glow: number; parts: Part[]; glowParts: Part[]; float?: number; bob?: number; scale?: number }

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cone = (r: number, h: number, s = 6) => new THREE.ConeGeometry(r, h, s);
const ico = (r: number, d = 0) => new THREE.IcosahedronGeometry(r, d);
const octa = (r: number) => new THREE.OctahedronGeometry(r, 0);
const cyl = (r1: number, r2: number, h: number, s = 6) => new THREE.CylinderGeometry(r1, r2, h, s);

const LOOKS: Look[] = [
  { // 0 HUSK: hunched shambler, ember eyes
    body: 0x4a2418, glow: 0xff6a2b, bob: 0.1,
    parts: [{ g: cone(0.55, 1.2), y: 0.6, z: -0.1, rx: 0.25 }, { g: ico(0.3), y: 1.1, z: 0.3 }, { g: box(0.18, 0.18, 0.7), x: 0.5, y: 0.8, z: 0.4 }, { g: box(0.18, 0.18, 0.7), x: -0.5, y: 0.8, z: 0.4 }],
    glowParts: [{ g: box(0.12, 0.08, 0.06), x: 0.1, y: 1.15, z: 0.57 }, { g: box(0.12, 0.08, 0.06), x: -0.1, y: 1.15, z: 0.57 }],
  },
  { // 1 WISP: floating magenta core in thorns
    body: 0x2a0f26, glow: 0xff2e88, float: 0.9, bob: 0.25,
    parts: [{ g: cone(0.12, 0.7, 4), y: 0.5, rx: Math.PI, sx: 1 }, { g: cone(0.1, 0.5, 4), x: 0.35, y: 0, rz: -Math.PI / 2 }, { g: cone(0.1, 0.5, 4), x: -0.35, y: 0, rz: Math.PI / 2 }, { g: cone(0.1, 0.6, 4), y: -0.45 }],
    glowParts: [{ g: ico(0.3, 1) }],
  },
  { // 2 BRUTE: blocky lime-cracked tank
    body: 0x24301a, glow: 0xb6ff3b, scale: 1.0, bob: 0.04,
    parts: [{ g: box(1.5, 1.4, 1.1), y: 1.1 }, { g: box(0.7, 0.55, 0.6), y: 2.0, z: 0.15 }, { g: box(0.55, 0.9, 0.55), x: 1.0, y: 0.9, z: 0.1 }, { g: box(0.55, 0.9, 0.55), x: -1.0, y: 0.9, z: 0.1 }, { g: box(0.5, 0.6, 0.5), x: 0.4, y: 0.3 }, { g: box(0.5, 0.6, 0.5), x: -0.4, y: 0.3 }],
    glowParts: [{ g: box(0.08, 1.0, 0.04), x: 0.2, y: 1.2, z: 0.57, rz: 0.3 }, { g: box(0.08, 0.7, 0.04), x: -0.3, y: 1.1, z: 0.57, rz: -0.4 }, { g: box(0.45, 0.07, 0.04), y: 2.05, z: 0.46 }],
  },
  { // 3 SKITTER: low spider pack
    body: 0x3a1230, glow: 0xff2e88, bob: 0.05, scale: 1.0,
    parts: [{ g: ico(0.35), y: 0.45, sy: 0.7, sz: 1.3 }, ...[-1, 1].flatMap(s => [0.25, -0.05, -0.35].map(z => ({ g: box(0.7, 0.07, 0.07), x: s * 0.5, y: 0.3, z, rz: s * -0.5 })))],
    glowParts: [{ g: box(0.1, 0.07, 0.05), x: 0.1, y: 0.55, z: 0.42 }, { g: box(0.1, 0.07, 0.05), x: -0.1, y: 0.55, z: 0.42 }],
  },
  { // 4 BLOATER: fat toxic sack
    body: 0x2c3a14, glow: 0xb6ff3b, bob: 0.12, scale: 1.0,
    parts: [{ g: ico(0.85, 1), y: 0.95 }, { g: cone(0.2, 0.4, 5), y: 0.2, x: 0.4 }, { g: cone(0.2, 0.4, 5), y: 0.2, x: -0.4 }],
    glowParts: [{ g: ico(0.2), x: 0.45, y: 1.3, z: 0.5 }, { g: ico(0.15), x: -0.5, y: 0.9, z: 0.55 }, { g: ico(0.18), x: 0.1, y: 1.65, z: -0.3 }, { g: box(0.3, 0.1, 0.1), y: 1.05, z: 0.82 }],
  },
  { // 5 SHIELD KNIGHT: armored, gold visor, front slab
    body: 0x2a2f3c, glow: 0xffcf3a, bob: 0.05,
    parts: [{ g: box(0.8, 1.2, 0.6), y: 1.0 }, { g: box(0.5, 0.5, 0.5), y: 1.85 }, { g: box(0.3, 0.8, 0.3), x: 0.2, y: 0.4 }, { g: box(0.3, 0.8, 0.3), x: -0.2, y: 0.4 }, { g: box(1.3, 1.5, 0.15), y: 1.15, z: 0.55 }],
    glowParts: [{ g: box(0.36, 0.07, 0.05), y: 1.88, z: 0.26 }, { g: box(0.5, 0.06, 0.04), y: 1.15, z: 0.64 }],
  },
  { // 6 SPITTER: slim, amber maw
    body: 0x3a2a10, glow: 0xffb02e, bob: 0.08,
    parts: [{ g: cone(0.4, 1.5), y: 0.75 }, { g: ico(0.38), y: 1.6, z: 0.1 }, { g: cone(0.1, 0.5, 4), y: 2.1, rx: -0.3 }],
    glowParts: [{ g: box(0.34, 0.14, 0.1), y: 1.55, z: 0.45 }, { g: ico(0.1), y: 0.9, z: 0.3 }],
  },
  { // 7 WRAITH: tattered hooded specter
    body: 0x1d1030, glow: 0xc04dff, float: 0.35, bob: 0.2,
    parts: [{ g: cone(0.6, 1.9, 5), y: 0.95, sx: 1, sz: 0.8 }, { g: cone(0.3, 0.55, 5), y: 1.95, z: -0.05 }, { g: cone(0.18, 0.8, 4), x: 0.4, y: 0.2, rz: -0.4 }, { g: cone(0.18, 0.8, 4), x: -0.4, y: 0.2, rz: 0.4 }],
    glowParts: [{ g: box(0.1, 0.12, 0.05), x: 0.1, y: 1.75, z: 0.22 }, { g: box(0.1, 0.12, 0.05), x: -0.1, y: 1.75, z: 0.22 }],
  },
  { // 8 BOSS: towering antlered stag-wraith (shared by all 3 bosses until bespoke models land)
    body: 0x24121a, glow: 0xff2a2a, bob: 0.05, scale: 2.4,
    parts: [{ g: cone(0.8, 2.2), y: 1.1 }, { g: ico(0.45), y: 2.3, z: 0.15 }, { g: cone(0.12, 1.4, 4), x: 0.35, y: 3.0, rz: -0.5 }, { g: cone(0.12, 1.4, 4), x: -0.35, y: 3.0, rz: 0.5 },
      { g: cone(0.1, 0.9, 4), x: 0.75, y: 3.4, rz: -0.9 }, { g: cone(0.1, 0.9, 4), x: -0.75, y: 3.4, rz: 0.9 }, { g: box(0.3, 1.2, 0.3), x: 0.6, y: 0.6, z: 0.3 }, { g: box(0.3, 1.2, 0.3), x: -0.6, y: 0.6, z: 0.3 }],
    glowParts: [{ g: box(0.12, 0.1, 0.06), x: 0.15, y: 2.35, z: 0.55 }, { g: box(0.12, 0.1, 0.06), x: -0.15, y: 2.35, z: 0.55 }, { g: ico(0.25, 1), y: 1.4, z: 0.4 }],
  },
];

function build(parts: Part[]): G {
  const gs = parts.map(p => {
    const g = p.g.clone().toNonIndexed(); // consistent attributes for merge
    g.deleteAttribute('uv');
    const m = new THREE.Matrix4().compose(new THREE.Vector3(p.x ?? 0, p.y ?? 0, p.z ?? 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0)), new THREE.Vector3(p.sx ?? 1, p.sy ?? 1, p.sz ?? 1));
    g.applyMatrix4(m); return g;
  });
  return mergeGeometries(gs)!;
}

export const KIND_COLORS = LOOKS.map(l => l.glow);
export class EnemyRenderer {
  private body: THREE.InstancedMesh[] = []; private glow: THREE.InstancedMesh[] = [];
  private counts = new Int32Array(LOOKS.length); private m = new THREE.Object3D(); private c = new THREE.Color();
  constructor(scene: THREE.Scene) {
    LOOKS.forEach((l, k) => {
      const bm = new THREE.InstancedMesh(build(l.parts), new THREE.MeshLambertMaterial({ color: l.body, flatShading: true, emissive: l.glow, emissiveIntensity: 0.07 }), MAX_ENEMIES);
      const gm = new THREE.InstancedMesh(build(l.glowParts), new THREE.MeshBasicMaterial({ color: new THREE.Color(l.glow).multiplyScalar(1.7), toneMapped: false }), MAX_ENEMIES);
      bm.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_ENEMIES * 3).fill(1), 3);
      for (const x of [bm, gm]) { x.frustumCulled = false; x.count = 0; scene.add(x); }
      bm.castShadow = k !== 1; this.body.push(bm); this.glow.push(gm);
    });
  }
  update(e: EnemyPool, t: number) {
    this.counts.fill(0); const m = this.m;
    for (let i = 0; i < e.count; i++) {
      if (!e.alive[i]) continue;
      const k = e.kind[i] < LOOKS.length ? e.kind[i] : 0, l = LOOKS[k], n = this.counts[k]++;
      const ph = t * (l.float ? 3 : 9) + i * 1.7, bob = Math.abs(Math.sin(ph)) * (l.bob ?? 0);
      m.position.set(e.x[i], (l.float ?? 0) + (l.float ? Math.sin(ph) * (l.bob ?? 0) : bob), e.z[i]);
      m.rotation.set(0, e.facing[i], l.float ? 0 : Math.sin(ph) * 0.08); m.scale.setScalar(l.scale ?? 1); m.updateMatrix();
      this.body[k].setMatrixAt(n, m.matrix); this.glow[k].setMatrixAt(n, m.matrix);
      const f = e.hitFlash[i] > 0 ? 4 : 1; this.c.setRGB(f, f, f); this.body[k].setColorAt(n, this.c);
    }
    for (let k = 0; k < LOOKS.length; k++) {
      const n = this.counts[k]; for (const x of [this.body[k], this.glow[k]]) { x.count = n; x.instanceMatrix.needsUpdate = true; }
      this.body[k].instanceColor!.needsUpdate = true;
    }
  }
}
