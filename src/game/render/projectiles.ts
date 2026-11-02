import * as THREE from 'three';
import type { SimState } from '@shared/types';
import { MAX_PROJECTILES, MAX_PICKUPS } from '@shared/types';
import type { Vfx } from './vfx';
/** Instanced drawing of projectiles (bolts+trails, orbit blades, chain sparks, nova rings, lava discs) and XP gems.
 *  Projectile kinds: 0 bolt, 1 orbit blade, 2 nova ring, 3 chain spark, 4 lava patch, 5 seeker spear. Add new kinds HERE, not in renderer.ts. */
export class ProjectileRenderer {
  projMesh!: THREE.InstancedMesh; trailMesh!: THREE.InstancedMesh; ringMesh!: THREE.InstancedMesh; lavaMesh!: THREE.InstancedMesh; lavaRim!: THREE.InstancedMesh; gemMesh!: THREE.InstancedMesh; chestMesh!: THREE.InstancedMesh;
  private m = new THREE.Object3D(); private flashColor = new THREE.Color(0xffffff);
  constructor(scene: THREE.Scene, private vfx: Vfx) {
    const emissive = (c: number) => new THREE.MeshBasicMaterial({ color: c });
    const bolt = new THREE.CapsuleGeometry(0.13, 0.5, 3, 6); bolt.rotateX(Math.PI / 2); // 0.5u glowing capsule along +Z; octahedron kept look for other kinds via scale
    this.projMesh = new THREE.InstancedMesh(bolt, emissive(0xffffff), MAX_PROJECTILES);
    { // additive tapered trail (6u), vertex colour fades to black = transparent under additive blending
      const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute([-0.18, 0, 0, 0.18, 0, 0, 0, 0, -6], 3)); tg.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 1, 1, 1, 0, 0, 0], 3));
      this.trailMesh = new THREE.InstancedMesh(tg, new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide }), MAX_PROJECTILES);
      this.trailMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PROJECTILES * 3), 3); this.trailMesh.frustumCulled = false; this.trailMesh.count = 0; scene.add(this.trailMesh); }
    this.projMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PROJECTILES * 3), 3);
    this.ringMesh = new THREE.InstancedMesh(new THREE.RingGeometry(0.85, 1, 40), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }), 64);
    this.ringMesh.frustumCulled = false; scene.add(this.ringMesh);
    this.lavaMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false }), MAX_PROJECTILES); // dim base layer (0.85 read as a solid orange blob); bright rim = lavaRim
    this.lavaMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PROJECTILES * 3), 3); this.lavaMesh.frustumCulled = false; this.lavaMesh.count = 0; scene.add(this.lavaMesh);
    this.lavaRim = new THREE.InstancedMesh(new THREE.RingGeometry(0.8, 1, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }), MAX_PROJECTILES);
    this.lavaRim.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PROJECTILES * 3), 3); this.lavaRim.frustumCulled = false; this.lavaRim.count = 0; scene.add(this.lavaRim);
    this.gemMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x4de8ff).multiplyScalar(2.6) }), MAX_PICKUPS);
    this.chestMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.6, 0.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb020).multiplyScalar(1.3) }), 64); this.chestMesh.count = 0;
    for (const m of [this.projMesh, this.gemMesh, this.chestMesh]) { m.frustumCulled = false; scene.add(m); }
  }
  update(s: SimState, trailTick: number) {
    let n = 0;
    n = 0; let rn = 0, tn = 0, ln = 0; const pr = s.projectiles; this.vfx.zapBegin(); let lx = 0, lz = 0, ll = -1;
    for (let i = 0; i < pr.count; i++) { if (!pr.alive[i]) continue;
      const k = pr.kind[i];
      if (k === 3) { if (ll >= 0 && Math.abs(pr.life[i] - ll) < 0.03 && Math.hypot(pr.x[i] - lx, pr.z[i] - lz) < 9) this.vfx.zap(lx, lz, pr.x[i], pr.z[i]); lx = pr.x[i]; lz = pr.z[i]; ll = pr.life[i]; }
      else if (k === 1 && (trailTick & 1) === 0) this.vfx.trail(pr.x[i], 0.8, pr.z[i], 0x6fe8ff);
      if (k === 2) { const maxLife = 0.35, f = 1 - pr.life[i] / maxLife, r = pr.vx[i] * f; this.m.position.set(pr.x[i], 0.15, pr.z[i]); this.m.rotation.set(-Math.PI / 2, 0, 0); this.m.scale.set(r, r, r); this.m.updateMatrix(); this.ringMesh.setMatrixAt(rn++, this.m.matrix); continue; }
      if (k === 4) { const f = Math.min(1, pr.life[i] / 0.6), r = pr.vx[i] * (0.75 + 0.25 * f) * (1 + 0.06 * Math.sin(s.time * 9 + i)); this.m.position.set(pr.x[i], 0.05, pr.z[i]); this.m.rotation.set(-Math.PI / 2, 0, 0); this.m.scale.set(r, r, r); this.m.updateMatrix(); this.lavaMesh.setMatrixAt(ln, this.m.matrix);
        this.flashColor.setHex(0xff4a14).multiplyScalar(0.7 + 0.9 * f); this.lavaMesh.setColorAt(ln, this.flashColor); this.m.position.y = 0.09; this.m.updateMatrix(); this.lavaRim.setMatrixAt(ln, this.m.matrix); this.flashColor.setHex(0xff6a20).multiplyScalar(0.9 + 1.4 * f); this.lavaRim.setColorAt(ln++, this.flashColor); continue; }
      if (k === 5) { const yaw = Math.atan2(pr.vx[i], pr.vz[i]); // seeker spear: gold edge streak under a cyan-white streak
        this.m.position.set(pr.x[i], 0.78, pr.z[i]); this.m.rotation.set(0, yaw, 0); this.m.scale.set(1.5, 1, 0.75); this.m.updateMatrix(); this.trailMesh.setMatrixAt(tn, this.m.matrix); this.flashColor.setHex(0xffc84a).multiplyScalar(1.2); this.trailMesh.setColorAt(tn++, this.flashColor);
        this.m.position.y = 0.8; this.m.scale.set(1, 1, 0.7); this.m.updateMatrix(); this.trailMesh.setMatrixAt(tn, this.m.matrix); this.flashColor.setHex(0x8ff0ff).multiplyScalar(2.2); this.trailMesh.setColorAt(tn++, this.flashColor); }
      if (k === 0) { const yaw = Math.atan2(pr.vx[i], pr.vz[i]);
        this.m.position.set(pr.x[i], 0.8, pr.z[i]); this.m.rotation.set(0, yaw, 0); this.m.scale.setScalar(1); this.m.updateMatrix(); this.trailMesh.setMatrixAt(tn, this.m.matrix);
        this.flashColor.setHex(0xffd35a).multiplyScalar(2.2); this.trailMesh.setColorAt(tn++, this.flashColor); }
      this.m.position.set(pr.x[i], 0.8, pr.z[i]); this.m.rotation.set(0, k === 0 || k === 5 ? Math.atan2(pr.vx[i], pr.vz[i]) : s.time * 8, 0); this.m.scale.setScalar(k === 1 ? 1.8 : k === 3 ? 2.2 : 1); this.m.updateMatrix(); this.projMesh.setMatrixAt(n, this.m.matrix);
      this.flashColor.setHex(k === 1 ? 0x6fe8ff : k === 3 ? 0xfff6a8 : k === 5 ? 0xd8fbff : 0xffd27a); this.flashColor.multiplyScalar(2.8); this.projMesh.setColorAt(n, this.flashColor); n++; }
    this.vfx.zapEnd(); this.m.scale.setScalar(1); this.ringMesh.count = rn; this.ringMesh.instanceMatrix.needsUpdate = true; if (this.projMesh.instanceColor) this.projMesh.instanceColor.needsUpdate = true;
    this.projMesh.count = n; this.projMesh.instanceMatrix.needsUpdate = true;
    this.trailMesh.count = tn; this.trailMesh.instanceMatrix.needsUpdate = true; this.trailMesh.instanceColor!.needsUpdate = true;
    this.lavaRim.count = ln; this.lavaRim.instanceMatrix.needsUpdate = true; if (this.lavaRim.instanceColor) this.lavaRim.instanceColor.needsUpdate = true; this.lavaMesh.count = ln; this.lavaMesh.instanceMatrix.needsUpdate = true; if (this.lavaMesh.instanceColor) this.lavaMesh.instanceColor.needsUpdate = true;
    n = 0; let cn = 0; const pk = s.pickups; for (let i = 0; i < pk.count; i++) { if (!pk.alive[i]) continue;
      if (pk.kind[i] === 1) { this.m.position.set(pk.x[i], 0.55 + Math.sin(s.time * 3) * 0.12, pk.z[i]); this.m.rotation.set(0, s.time * 1.5, 0); this.m.scale.setScalar(1.6); this.m.updateMatrix(); if (cn < 64) this.chestMesh.setMatrixAt(cn++, this.m.matrix); this.m.scale.setScalar(1); continue; }
      this.m.position.set(pk.x[i], 0.4 + Math.sin(s.time * 4 + i) * 0.1, pk.z[i]); this.m.rotation.set(0, s.time * 2 + i, 0); this.m.updateMatrix(); this.gemMesh.setMatrixAt(n++, this.m.matrix); if (pk.magnet[i] && (trailTick & 1)) this.vfx.trail(pk.x[i], 0.45, pk.z[i]); }
    this.gemMesh.count = n; this.gemMesh.instanceMatrix.needsUpdate = true; this.chestMesh.count = cn; this.chestMesh.instanceMatrix.needsUpdate = true;
  }
}
