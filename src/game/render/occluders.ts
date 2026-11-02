import * as THREE from 'three';
/** Fades (scales down) scenery instances that stand between the camera and the hero, so the playfield is never hidden.
 *  Collects every InstancedMesh the arena added to the scene; smooth per-instance scale toward SMALL when in the occlusion corridor. */
const SMALL = 0.08;
interface Entry { mesh: THREE.InstancedMesh; orig: Float32Array; x: Float32Array; z: Float32Array; f: Float32Array; cap: Float32Array; capped: boolean; dirty: boolean }
/** Props nearer than NEAR_CAP_R to the hero, or in the camera-side zone, are scaled so they stand <= MAX_H tall. */
const MAX_H = 1.5, NEAR_CAP_R = 16;
export class OccluderFader {
  private entries: Entry[] = []; private m = new THREE.Matrix4(); private e = new THREE.Matrix4();
  constructor(scene: THREE.Scene, roots?: THREE.Object3D[]) {
    const visit = (f: (o: THREE.Object3D) => void) => roots ? roots.forEach(r => r.traverse(f)) : scene.traverse(f);
    visit(o => { const im = o as THREE.InstancedMesh; if (!im.isInstancedMesh) return;
      const n = im.count, orig = new Float32Array(n * 16), x = new Float32Array(n), z = new Float32Array(n), cap = new Float32Array(n).fill(1);
      im.geometry.computeBoundingBox(); const bb = im.geometry.boundingBox!, gh = Math.max(0.01, bb.max.y - Math.min(0, bb.min.y)), capped = !im.userData.noHeightCap;
      for (let i = 0; i < n; i++) { im.getMatrixAt(i, this.m); this.m.toArray(orig, i * 16); x[i] = this.m.elements[12]; z[i] = this.m.elements[14];
        const ys = Math.hypot(this.m.elements[4], this.m.elements[5], this.m.elements[6]); cap[i] = Math.min(1, MAX_H / (gh * ys)); }
      this.entries.push({ mesh: im, orig, x, z, f: new Float32Array(n).fill(1), cap, capped, dirty: false }); });
  }
  /** hx,hz = hero position; camera sits on +z side of the hero. */
  update(dt: number, hx: number, hz: number) {
    const k = 1 - Math.exp(-10 * dt);
    for (const en of this.entries) { const n = en.f.length; let changed = false;
      for (let i = 0; i < n; i++) {
        const dz = en.z[i] - hz, dx = en.x[i] - hx;
        const inCorridor = dz > -2 && dz < 17 && Math.abs(dx) < 4.5 + Math.max(0, dz) * 0.4, near = dx * dx + dz * dz < 42; // clear zone ~6.5u around the hero
        const camSide = dz > -2 && dz < 26 && Math.abs(dx) < 16, close = dx * dx + dz * dz < NEAR_CAP_R * NEAR_CAP_R;
        const target = inCorridor || near ? SMALL : en.capped && (close || camSide) ? Math.max(SMALL, en.cap[i]) : 1, f = en.f[i];
        if (Math.abs(f - target) < 0.004) { if (f !== target) { en.f[i] = target; changed = true; this.write(en, i); } continue; }
        en.f[i] = f + (target - f) * k; changed = true; this.write(en, i);
      }
      if (changed) en.mesh.instanceMatrix.needsUpdate = true; }
  }
  private write(en: Entry, i: number) {
    this.m.fromArray(en.orig, i * 16); const f = en.f[i], t = this.m.elements;
    for (let c = 0; c < 12; c++) if (c % 4 !== 3) t[c] *= f; // scale basis vectors, keep translation
    en.mesh.setMatrixAt(i, this.m);
  }
}
