import * as THREE from 'three';

const N = 3000;
/** CPU-simulated debris/sparks in one InstancedMesh (1 draw call). Spawn API is allocation-free. */
export class Particles {
  mesh: THREE.InstancedMesh;
  private px = new Float32Array(N); py = new Float32Array(N); pz = new Float32Array(N);
  private vx = new Float32Array(N); vy = new Float32Array(N); vz = new Float32Array(N);
  private life = new Float32Array(N); max = new Float32Array(N); size = new Float32Array(N);
  private grav = new Float32Array(N); rot = new Float32Array(N); spin = new Float32Array(N);
  private cr = new Float32Array(N); cg = new Float32Array(N); cb = new Float32Array(N);
  private head = 0; private tmp = new THREE.Color();
  constructor(scene: THREE.Scene) {
    const mat = new THREE.MeshBasicMaterial({ toneMapped: true });
    this.mesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1), mat, N);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    this.mesh.frustumCulled = false; this.mesh.count = 0; scene.add(this.mesh);
  }
  private emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, col: number, bright: number, grav: number) {
    const i = this.head; this.head = (this.head + 1) % N;
    this.px[i] = x; this.py[i] = y; this.pz[i] = z; this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.life[i] = this.max[i] = life; this.size[i] = size; this.grav[i] = grav; this.rot[i] = Math.random() * 6; this.spin[i] = (Math.random() - 0.5) * 14;
    this.tmp.setHex(col); this.cr[i] = this.tmp.r * bright; this.cg[i] = this.tmp.g * bright; this.cb[i] = this.tmp.b * bright;
    if (i >= this.mesh.count) this.mesh.count = i + 1;
  }
  /** Radial burst on the ground plane + upward spray. */
  burst(x: number, z: number, n: number, speed: number, life: number, size: number, col: number, bright = 2, up = 4, grav = 14, y = 0.6) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.2832, s = speed * (0.35 + Math.random() * 0.65);
      this.emit(x, y, z, Math.cos(a) * s, up * (0.3 + Math.random()), Math.sin(a) * s, life * (0.6 + Math.random() * 0.4), size * (0.6 + Math.random() * 0.6), col, bright, grav);
    }
  }
  /** Flat expanding ring of particles. */
  ring(x: number, z: number, n: number, speed: number, life: number, size: number, col: number, bright = 2.5) {
    for (let k = 0; k < n; k++) { const a = k / n * 6.2832; this.emit(x, 0.15, z, Math.cos(a) * speed, 0.2, Math.sin(a) * speed, life, size, col, bright, 0); }
  }
  update(dt: number) {
    const m = this.mesh, arr = m.instanceMatrix.array as Float32Array, col = m.instanceColor!.array as Float32Array;
    
    for (let i = 0; i < m.count; i++) {
      let L = this.life[i];
      if (L <= 0) { arr[i * 16 + 0] = arr[i * 16 + 5] = arr[i * 16 + 10] = 0; continue; }
      L -= dt; this.life[i] = L;
      if (L <= 0) { arr[i * 16 + 0] = arr[i * 16 + 5] = arr[i * 16 + 10] = 0; continue; }
      this.vy[i] -= this.grav[i] * dt; const drag = Math.exp(-2.2 * dt); this.vx[i] *= drag; this.vz[i] *= drag;
      this.px[i] += this.vx[i] * dt; this.py[i] += this.vy[i] * dt; this.pz[i] += this.vz[i] * dt;
      if (this.py[i] < 0.05) { this.py[i] = 0.05; this.vy[i] *= -0.3; }
      const f = L / this.max[i], s = this.size[i] * Math.min(1, f * 2.5), r = (this.rot[i] += this.spin[i] * dt), c = Math.cos(r) * s, sn = Math.sin(r) * s, o = i * 16;
      arr[o] = c; arr[o + 1] = 0; arr[o + 2] = -sn; arr[o + 3] = 0; arr[o + 4] = 0; arr[o + 5] = s; arr[o + 6] = 0; arr[o + 7] = 0;
      arr[o + 8] = sn; arr[o + 9] = 0; arr[o + 10] = c; arr[o + 11] = 0; arr[o + 12] = this.px[i]; arr[o + 13] = this.py[i]; arr[o + 14] = this.pz[i]; arr[o + 15] = 1;
      const fade = Math.min(1, f * 1.5); col[i * 3] = this.cr[i] * fade; col[i * 3 + 1] = this.cg[i] * fade; col[i * 3 + 2] = this.cb[i] * fade;
    }
    m.instanceMatrix.needsUpdate = true; m.instanceColor!.needsUpdate = true;
  }
}
