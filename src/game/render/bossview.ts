import * as THREE from 'three';
import type { SimState } from '@shared/types';
import { createBoss, type Boss, type BossId } from './bosses';
import { BOSSES } from '@sim/content/enemies';
/** Draws the active sim boss (SimState.boss) with CD's bespoke models; follows the boss enemy slot. */
export class BossView {
  private cur: { id: string; boss: Boss } | null = null;
  constructor(private scene: THREE.Scene) {}
  get active() { return !!this.cur; }
  update(s: SimState) {
    const b = s.boss;
    if (!b) { if (this.cur) { this.scene.remove(this.cur.boss.group); this.cur = null; } return; }
    if (!this.cur || this.cur.id !== b.id) {
      if (this.cur) this.scene.remove(this.cur.boss.group);
      this.cur = { id: b.id, boss: createBoss(b.id as BossId) }; this.scene.add(this.cur.boss.group);
    }
    const e = s.enemies, i = b.idx, d = BOSSES[b.id], g = this.cur.boss.group;
    g.position.set(e.x[i], 0, e.z[i]); g.rotation.y = e.facing[i];
    const hpLost = Math.min(1, Math.max(0, 1 - e.hp[i] / b.maxHp)), tele = b.mode === 1 ? Math.min(1, b.t / d.windup) : b.mode === 2 ? 1 : 0;
    this.cur.boss.update(s.time, hpLost, tele); this.cur.boss.flash(e.hitFlash[i] > 0);
  }
}
