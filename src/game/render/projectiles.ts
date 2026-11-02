import * as THREE from 'three';
import type { SimState } from '@shared/types';
import { MAX_PROJECTILES, MAX_PICKUPS } from '@shared/types';
import type { Vfx } from './vfx';
/** Instanced drawing of projectiles (bolts+trails, orbit blades, chain sparks, nova rings, lava discs) and XP gems.
 *  Projectile kinds: 0 bolt, 1 orbit blade, 2 nova ring, 3 chain spark, 4 lava patch, 5 seeker spear. Add new kinds HERE, not in renderer.ts. */
export class ProjectileRenderer {
  projMesh!: THREE.InstancedMesh; trailMesh!: THREE.InstancedMesh; ringMesh!: THREE.InstancedMesh; lavaMesh!: THREE.InstancedMesh; bladeMesh!: THREE.InstancedMesh; gemMesh!: THREE.InstancedMesh; chestMesh!: THREE.InstancedMesh; beamMesh!: THREE.InstancedMesh;
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
    { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); // soft glow, no hard edge: overlapping patches add up into one smear
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      this.lavaMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }), MAX_PROJECTILES); }
    this.lavaMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PROJECTILES * 3), 3); this.lavaMesh.frustumCulled = false; this.lavaMesh.count = 0; scene.add(this.lavaMesh);
    this.gemMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x4de8ff).multiplyScalar(2.6) }), MAX_PICKUPS);
    { const bg = new THREE.OctahedronGeometry(0.5, 0); bg.scale(0.5, 0.12, 1.5); this.bladeMesh = new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xbff6ff).multiplyScalar(3), toneMapped: false }), 64); this.bladeMesh.frustumCulled = false; this.bladeMesh.count = 0; scene.add(this.bladeMesh); }
    this.chestMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.6, 0.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb020).multiplyScalar(1.3) }), 64); this.chestMesh.count = 0;
    { // gold light beam above each chest: tall additive column whose vertex colour fades to black at the top (reads from across the arena)
      const bg = new THREE.BufferGeometry(); const w = 0.4, h = 4.5; bg.setAttribute('position', new THREE.Float32BufferAttribute([-w, 0, 0, w, 0, 0, w * 0.4, h, 0, -w, 0, 0, w * 0.4, h, 0, -w * 0.4, h, 0, 0, 0, -w, 0, 0, w, 0, h, w * 0.4, 0, 0, -w, 0, h, w * 0.4, 0, h, -w * 0.4], 3));
      bg.setAttribute('color', new THREE.Float32BufferAttribute([1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0], 3));
      this.beamMesh = new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(0xffc44a).multiplyScalar(0.8), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), 64); this.beamMesh.frustumCulled = false; this.beamMesh.count = 0; scene.add(this.beamMesh); }
    for (const m of [this.projMesh, this.gemMesh, this.chestMesh]) { m.frustumCulled = false; scene.add(m); }
  }
  update(s: SimState, trailTick: number) {
    let n = 0;
    n = 0; let rn = 0, tn = 0, ln = 0, bn = 0; const pr = s.projectiles; this.vfx.zapBegin(); let lx = 0, lz = 0, ll = -1;
    for (let i = 0; i < pr.count; i++) { if (!pr.alive[i]) continue;
      const k = pr.kind[i];
      if (k === 3) { if (pr.life[i] > 0.1) this.vfx.ring(pr.x[i], pr.z[i], 0xcfefff, 1.1, 0.14, 0.9); if (ll >= 0 && Math.abs(pr.life[i] - ll) < 0.03 && Math.hypot(pr.x[i] - lx, pr.z[i] - lz) < 9) this.vfx.zap(lx, lz, pr.x[i], pr.z[i]); lx = pr.x[i]; lz = pr.z[i]; ll = pr.life[i]; }
      else if (k === 1) { if ((trailTick & 1) === 0) this.vfx.trail(pr.x[i], 0.8, pr.z[i], 0x6fe8ff);
        const pp = s.players[0]; this.m.position.set(pr.x[i], 0.8, pr.z[i]); this.m.rotation.set(0, Math.atan2(pr.x[i] - pp.x, pr.z[i] - pp.z) + Math.PI / 2, 0); this.m.scale.setScalar(1); this.m.updateMatrix(); this.bladeMesh.setMatrixAt(bn++, this.m.matrix); continue; }
      if (k === 2) { const maxLife = 0.35, f = 1 - pr.life[i] / maxLife, r = pr.vx[i] * f; this.m.position.set(pr.x[i], 0.15, pr.z[i]); this.m.rotation.set(-Math.PI / 2, 0, 0); this.m.scale.set(r, r, r); this.m.updateMatrix(); this.ringMesh.setMatrixAt(rn++, this.m.matrix); continue; }
      if (k === 4) { const f = Math.min(1, pr.life[i] / 0.6), r = pr.vx[i] * (0.75 + 0.25 * f) * (1 + 0.06 * Math.sin(s.time * 9 + i)); this.m.position.set(pr.x[i], 0.05, pr.z[i]); this.m.rotation.set(-Math.PI / 2, 0, 0); this.m.scale.set(r, r, r); this.m.updateMatrix(); this.lavaMesh.setMatrixAt(ln, this.m.matrix);
        this.flashColor.setHex(0xff5a14).multiplyScalar(0.55 + 0.75 * f); this.lavaMesh.setColorAt(ln++, this.flashColor); continue; }
      if (k === 5) { const yaw = Math.atan2(pr.vx[i], pr.vz[i]); // seeker spear: gold edge streak under a cyan-white streak
        this.m.position.set(pr.x[i], 0.78, pr.z[i]); this.m.rotation.set(0, yaw, 0); this.m.scale.set(1.5, 1, 0.75); this.m.updateMatrix(); this.trailMesh.setMatrixAt(tn, this.m.matrix); this.flashColor.setHex(0xffc84a).multiplyScalar(1.2); this.trailMesh.setColorAt(tn++, this.flashColor);
        this.m.position.y = 0.8; this.m.scale.set(1, 1, 0.7); this.m.updateMatrix(); this.trailMesh.setMatrixAt(tn, this.m.matrix); this.flashColor.setHex(0x8ff0ff).multiplyScalar(2.2); this.trailMesh.setColorAt(tn++, this.flashColor); }
      if (k === 0) { const yaw = Math.atan2(pr.vx[i], pr.vz[i]);
        this.m.position.set(pr.x[i], 0.8, pr.z[i]); this.m.rotation.set(0, yaw, 0); this.m.scale.setScalar(1); this.m.updateMatrix(); this.trailMesh.setMatrixAt(tn, this.m.matrix);
        this.flashColor.setHex(0xffd35a).multiplyScalar(2.2); this.trailMesh.setColorAt(tn++, this.flashColor); }
      this.m.position.set(pr.x[i], 0.8, pr.z[i]); this.m.rotation.set(0, k === 0 || k === 5 ? Math.atan2(pr.vx[i], pr.vz[i]) : s.time * 8, 0); this.m.scale.setScalar(k === 1 ? 1.8 : k === 3 ? 0.9 : 1); this.m.updateMatrix(); this.projMesh.setMatrixAt(n, this.m.matrix);
      this.flashColor.setHex(k === 1 ? 0x6fe8ff : k === 3 ? 0xfff6a8 : k === 5 ? 0xd8fbff : k === 6 ? 0xff3a6a : 0xffd27a); this.flashColor.multiplyScalar(2.8); this.projMesh.setColorAt(n, this.flashColor); n++; }
    this.bladeMesh.count = bn; this.bladeMesh.instanceMatrix.needsUpdate = true; this.vfx.zapEnd(); this.m.scale.setScalar(1); this.ringMesh.count = rn; this.ringMesh.instanceMatrix.needsUpdate = true; if (this.projMesh.instanceColor) this.projMesh.instanceColor.needsUpdate = true;
    this.projMesh.count = n; this.projMesh.instanceMatrix.needsUpdate = true;
    this.trailMesh.count = tn; this.trailMesh.instanceMatrix.needsUpdate = true; this.trailMesh.instanceColor!.needsUpdate = true;
    this.lavaMesh.count = ln; this.lavaMesh.instanceMatrix.needsUpdate = true; if (this.lavaMesh.instanceColor) this.lavaMesh.instanceColor.needsUpdate = true;
    n = 0; let cn = 0; const pk = s.pickups; for (let i = 0; i < pk.count; i++) { if (!pk.alive[i]) continue;
      if (pk.kind[i] === 1) { this.m.position.set(pk.x[i], 0.55 + Math.sin(s.time * 3) * 0.12, pk.z[i]); this.m.rotation.set(0, s.time * 1.5, 0); this.m.scale.setScalar(1.6); this.m.updateMatrix(); if (cn < 64) { this.m.position.y = 0; this.m.rotation.set(0, s.time * 0.8, 0); this.m.scale.set(1, 0.8 + 0.2 * Math.sin(s.time * 3 + i), 1); this.m.updateMatrix(); this.beamMesh.setMatrixAt(cn, this.m.matrix); this.m.position.set(pk.x[i], 0.55 + Math.sin(s.time * 3) * 0.12, pk.z[i]); this.m.rotation.set(0, s.time * 1.5, 0); this.m.scale.setScalar(1.6); this.m.updateMatrix(); } if (cn < 64) this.chestMesh.setMatrixAt(cn++, this.m.matrix); this.m.scale.setScalar(1); continue; }
      this.m.position.set(pk.x[i], 0.4 + Math.sin(s.time * 4 + i) * 0.1, pk.z[i]); this.m.rotation.set(0, s.time * 2 + i, 0); this.m.updateMatrix(); this.gemMesh.setMatrixAt(n++, this.m.matrix); if (pk.magnet[i] && (trailTick & 1)) this.vfx.trail(pk.x[i], 0.45, pk.z[i]); }
    this.gemMesh.count = n; this.gemMesh.instanceMatrix.needsUpdate = true; this.chestMesh.count = cn; this.beamMesh.count = cn; this.beamMesh.instanceMatrix.needsUpdate = true; this.chestMesh.instanceMatrix.needsUpdate = true;
  }
}
