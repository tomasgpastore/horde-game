import * as THREE from 'three';
/** Fades (scales down) scenery instances that stand between the camera and the hero, so the playfield is never hidden.
 *  Collects every InstancedMesh the arena added to the scene; smooth per-instance scale toward SMALL when in the occlusion corridor. */
const SMALL = 0.08;
interface Entry { mesh: THREE.InstancedMesh; orig: Float32Array; x: Float32Array; z: Float32Array; f: Float32Array; dirty: boolean }
export class OccluderFader {
  private entries: Entry[] = []; private m = new THREE.Matrix4(); private e = new THREE.Matrix4();
  constructor(scene: THREE.Scene) {
    scene.traverse(o => { const im = o as THREE.InstancedMesh; if (!im.isInstancedMesh) return;
      const n = im.count, orig = new Float32Array(n * 16), x = new Float32Array(n), z = new Float32Array(n);
      for (let i = 0; i < n; i++) { im.getMatrixAt(i, this.m); this.m.toArray(orig, i * 16); x[i] = this.m.elements[12]; z[i] = this.m.elements[14]; }
      this.entries.push({ mesh: im, orig, x, z, f: new Float32Array(n).fill(1), dirty: false }); });
  }
  /** hx,hz = hero position; camera sits on +z side of the hero. */
  update(dt: number, hx: number, hz: number) {
    const k = 1 - Math.exp(-10 * dt);
    for (const en of this.entries) { const n = en.f.length; let changed = false;
      for (let i = 0; i < n; i++) {
        const dz = en.z[i] - hz, dx = en.x[i] - hx;
        const inCorridor = dz > -2 && dz < 17 && Math.abs(dx) < 4.5 + Math.max(0, dz) * 0.4, near = dx * dx + dz * dz < 12;
        const target = inCorridor || near ? SMALL : 1, f = en.f[i];
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
