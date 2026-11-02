import * as THREE from 'three';
import type { SimState } from '@shared/types';
import { createBoss, BOSS_COLORS, type Boss, type BossId } from './bosses';
import { BOSSES } from '@sim/content/enemies';
/** Draws the active sim boss (SimState.boss) with CD's bespoke models; follows the boss enemy slot. */
export class BossView {
  private cur: { id: string; boss: Boss } | null = null;
  private aura: THREE.Group; private disc: THREE.Mesh; private ring: THREE.Mesh;
  constructor(private scene: THREE.Scene) { // additive ground aura in the boss colour: makes a dark boss readable against the dark floor (Artist)
    const mat = () => new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false });
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(1, 40), mat()); this.ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), mat());
    this.aura = new THREE.Group(); this.aura.add(this.disc, this.ring); this.aura.rotation.x = -Math.PI / 2; this.aura.position.y = 0.07; this.aura.visible = false; scene.add(this.aura); }
  get active() { return !!this.cur; }
  update(s: SimState) {
    const b = s.boss;
    if (!b) { if (this.cur) { this.scene.remove(this.cur.boss.group); this.cur = null; } this.aura.visible = false; return; }
    if (!this.cur || this.cur.id !== b.id) {
      if (this.cur) this.scene.remove(this.cur.boss.group);
      this.cur = { id: b.id, boss: createBoss(b.id as BossId) }; this.scene.add(this.cur.boss.group);
    }
    const e = s.enemies, i = b.idx, d = BOSSES[b.id], g = this.cur.boss.group;
    g.position.set(e.x[i], 0, e.z[i]); g.rotation.y = e.facing[i];
    const hpLost = Math.min(1, Math.max(0, 1 - e.hp[i] / b.maxHp)), tele = b.mode === 1 ? Math.min(1, b.t / d.windup) : b.mode === 2 ? 1 : 0;
    { const c = BOSS_COLORS[b.id as BossId] ?? 0xff3355, pulse = 0.75 + 0.25 * Math.sin(s.time * 3), R = this.cur.boss.radius * 2.2 * (1 + tele * 0.12);
      this.aura.visible = true; this.aura.position.x = e.x[i]; this.aura.position.z = e.z[i]; this.aura.scale.set(R, R, 1);
      (this.disc.material as THREE.MeshBasicMaterial).color.setHex(c).multiplyScalar(0.16 * pulse * (1 + tele)); (this.ring.material as THREE.MeshBasicMaterial).color.setHex(c).multiplyScalar(0.9 * pulse); }
    this.cur.boss.update(s.time, hpLost, tele); this.cur.boss.flash(e.hitFlash[i] > 0);
  }
}
