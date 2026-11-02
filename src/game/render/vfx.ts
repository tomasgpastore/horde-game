import * as THREE from 'three';
/** Additive ground/burst VFX (Artist). Pooled expanding rings in ONE InstancedMesh (fade = colour scaled toward black under additive blending).
 *  Use: vfx.ring(x, z, 0x3df2ff, maxRadius, life) / vfx.levelUp(x,z) / vfx.muzzle(x,z,dirx,dirz) / vfx.impact(x,z,color); call vfx.update(dt) each frame. No per-frame allocation. */
export class Vfx {
  static N = 128; mesh: THREE.InstancedMesh; private o = new THREE.Object3D(); private c = new THREE.Color();
  private x = new Float32Array(Vfx.N); private z = new Float32Array(Vfx.N); private life = new Float32Array(Vfx.N); private max = new Float32Array(Vfx.N);
  private col = new Uint32Array(Vfx.N); private y = new Float32Array(Vfx.N); private head = 0;
  constructor(scene: THREE.Scene) {
    const g = new THREE.RingGeometry(0.92, 1, 48); g.rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }), Vfx.N);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Vfx.N * 3), 3); this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.renderOrder = 2; scene.add(this.mesh); this.initTrail(scene); this.initZap(scene);
  }
  ring(x: number, z: number, color: number, maxR: number, life: number, y = 0.12) {
    const i = this.head; this.head = (i + 1) % Vfx.N; this.x[i] = x; this.z[i] = z; this.y[i] = y; this.max[i] = maxR; this.life[i] = life; this.lifeMax[i] = life; this.col[i] = color;
  }
  private lifeMax = new Float32Array(Vfx.N);
  levelUp(x: number, z: number) { this.ring(x, z, 0x3df2ff, 14, 0.7); this.ring(x, z, 0xffffff, 8, 0.45); this.ring(x, z, 0x3df2ff, 4, 0.9, 0.5); }
  muzzle(x: number, z: number, dx: number, dz: number) { this.ring(x + dx * 1.1, z + dz * 1.1, 0xffd35a, 0.9, 0.12, 0.8); }
  impact(x: number, z: number, color = 0xffd35a) { this.ring(x, z, color, 1.3, 0.2, 0.5); }
  bossBurst(x: number, z: number) { this.ring(x, z, 0xff3355, 18, 0.9); this.ring(x, z, 0xffffff, 9, 0.5); }
  // --- chain lightning: immediate-mode jagged additive bolts (re-jittered every frame = flicker) ---
  static NZ = 320; private zm!: THREE.InstancedMesh; private zn = 0; private zc = new THREE.Color();
  private initZap(scene: THREE.Scene) { this.zm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }), Vfx.NZ);
    this.zm.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Vfx.NZ * 3), 3); this.zm.frustumCulled = false; this.zm.count = 0; scene.add(this.zm); }
  zapBegin() { this.zn = 0; }
  zap(x1: number, z1: number, x2: number, z2: number, y = 0.9, color = 0x66ccff, seg = 6, jag = 0.55) {
    let px = x1, pz = z1; const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz) || 1, nx = -dz / len, nz = dx / len;
    for (let i = 1; i <= seg && this.zn < Vfx.NZ; i++) {
      const t = i / seg, j = i === seg ? 0 : (Math.random() - 0.5) * 2 * jag, qx = x1 + dx * t + nx * j, qz = z1 + dz * t + nz * j;
      const sx = qx - px, sz = qz - pz, sl = Math.hypot(sx, sz) || 0.01;
      this.o.position.set((px + qx) / 2, y, (pz + qz) / 2); this.o.rotation.set(0, Math.atan2(sx, sz), 0); this.o.scale.set(0.11, 0.11, sl + 0.05); this.o.updateMatrix(); this.zm.setMatrixAt(this.zn, this.o.matrix);
      this.zc.setHex(color).multiplyScalar(2.4 * (0.7 + Math.random() * 0.6)); this.zm.setColorAt(this.zn++, this.zc); px = qx; pz = qz; }
    this.o.rotation.set(0, 0, 0);
  }
  zapEnd() { this.zm.count = this.zn; this.zm.instanceMatrix.needsUpdate = true; if (this.zm.instanceColor) this.zm.instanceColor.needsUpdate = true; }
  /** Frost nova: expanding ice ring (thick, #9fe8ff) + inner white pulse. */
  nova(x: number, z: number, R: number) { this.ring(x, z, 0x9fe8ff, R, 0.45, 0.2); this.ring(x, z, 0xffffff, R * 0.7, 0.3, 0.25); this.ring(x, z, 0x9fe8ff, R * 0.4, 0.5, 0.15); }
  // --- gem trail: tiny additive diamonds left behind magnetised gems; fade+shrink ---
  static NT = 256; private tm!: THREE.InstancedMesh; private tx = new Float32Array(Vfx.NT * 3); private tl = new Float32Array(Vfx.NT); private tc = new Uint32Array(Vfx.NT); private th = 0;
  private initTrail(scene: THREE.Scene) { this.tm = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }), Vfx.NT);
    this.tm.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Vfx.NT * 3), 3); this.tm.frustumCulled = false; this.tm.count = 0; scene.add(this.tm); }
  trail(x: number, y: number, z: number, color = 0x3df2ff) { const i = this.th; this.th = (i + 1) % Vfx.NT; this.tx[i * 3] = x; this.tx[i * 3 + 1] = y; this.tx[i * 3 + 2] = z; this.tl[i] = 0.35; this.tc[i] = color; }
  update(dt: number) {
    { let k = 0; for (let i = 0; i < Vfx.NT; i++) { if (this.tl[i] <= 0) continue; this.tl[i] -= dt; if (this.tl[i] <= 0) continue; const f = this.tl[i] / 0.35;
        this.o.position.set(this.tx[i * 3], this.tx[i * 3 + 1], this.tx[i * 3 + 2]); this.o.scale.setScalar(f); this.o.rotation.set(0, 0, 0); this.o.updateMatrix(); this.tm.setMatrixAt(k, this.o.matrix); this.c.setHex(this.tc[i]).multiplyScalar(2.5 * f); this.tm.setColorAt(k++, this.c); }
      this.tm.count = k; this.tm.instanceMatrix.needsUpdate = true; if (this.tm.instanceColor) this.tm.instanceColor.needsUpdate = true; }
    let n = 0;
    for (let i = 0; i < Vfx.N; i++) { if (this.life[i] <= 0) continue; this.life[i] -= dt; if (this.life[i] <= 0) continue;
      const t = 1 - this.life[i] / this.lifeMax[i], rad = this.max[i] * (1 - (1 - t) * (1 - t)), a = (1 - t) * (1 - t) * 1.6;
      this.o.position.set(this.x[i], this.y[i], this.z[i]); this.o.scale.set(rad, 1, rad); this.o.updateMatrix(); this.mesh.setMatrixAt(n, this.o.matrix);
      this.c.setHex(this.col[i]).multiplyScalar(a); this.mesh.setColorAt(n, this.c); n++; }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
/** Boss charge-line telegraph: red #ff3355 additive lane with edge glow and chevrons pointing along +Y of the plane (renderer rotates/scales it; opacity pulsed there). */
export function createTelegraph(): THREE.Mesh {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256; const g = cv.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, '#ff3355'); gr.addColorStop(0.18, '#ff335555'); gr.addColorStop(0.5, '#ff335522'); gr.addColorStop(0.82, '#ff335555'); gr.addColorStop(1, '#ff3355');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256); g.strokeStyle = '#ff6a80'; g.lineWidth = 5;
  for (let y = 20; y < 256; y += 48) { g.beginPath(); g.moveTo(8, y + 18); g.lineTo(32, y); g.lineTo(56, y + 18); g.stroke(); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 1; return m;
}
