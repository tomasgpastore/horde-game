import type { System } from '../system';
import { alloc } from '../pools';
import { MAX_ENEMIES, MAX_PROJECTILES } from '@shared/types';
/** Spitters (kind 6): hold ~9u from the hero, telegraph 0.6s (red ring), then lob a slow magenta orb (projectile kind 6).
 *  Orbs are dodgeable (dash i-frames) and hit the hero on contact. Timers are derived/transient (not serialized). */
export const SPITTER = 6, HOLD = 9, RANGE = 15, WINDUP = 0.6, COOLDOWN = 2.6, SHOT_SPEED = 7.5, SHOT_LIFE = 3.2, SHOT_DMG = 8, SHOT_R = 0.55;
export const spitCd = new Float32Array(MAX_ENEMIES), spitTele = new Float32Array(MAX_ENEMIES);
export const shotKind = 6;
export const spitterSystem: System = { name: 'spitters', update(s, c) {
  const e = s.enemies, pr = s.projectiles, p = s.players[0]; if (p.dead) return;
  for (let i = 0; i < e.count; i++) { if (!e.alive[i] || e.kind[i] !== SPITTER) continue;
    const dx = p.x - e.x[i], dz = p.z - e.z[i], d = Math.hypot(dx, dz) || 1;
    if (spitTele[i] > 0) { spitTele[i] -= c.dt;
      if (spitTele[i] <= 0) { const j = alloc(pr.alive, pr.count, MAX_PROJECTILES); if (j >= 0) {
        pr.alive[j] = 1; pr.kind[j] = shotKind; pr.owner[j] = 255; pr.x[j] = e.x[i]; pr.z[j] = e.z[i]; pr.vx[j] = dx / d * SHOT_SPEED; pr.vz[j] = dz / d * SHOT_SPEED; pr.life[j] = SHOT_LIFE; pr.dmg[j] = SHOT_DMG; pr.pierce[j] = 0; if (j >= pr.count) pr.count = j + 1; }
        spitCd[i] = COOLDOWN; }
    } else if ((spitCd[i] -= c.dt) <= 0 && d < RANGE) { spitTele[i] = WINDUP; s.events.push({ t: 'telegraph', x: e.x[i], z: e.z[i], kind: SPITTER }); }
  }
  // orb flight + hero hit
  for (let j = 0; j < pr.count; j++) { if (!pr.alive[j] || pr.kind[j] !== shotKind) continue;
    pr.x[j] += pr.vx[j] * c.dt; pr.z[j] += pr.vz[j] * c.dt;
    const hx = p.x - pr.x[j], hz = p.z - pr.z[j];
    if (hx * hx + hz * hz < (SHOT_R + 0.4) ** 2 && p.iframes <= 0) { const dmg = Math.max(1, pr.dmg[j] - (p.stats.armor ?? 0)); p.hp -= dmg; p.iframes = 0.6; pr.alive[j] = 0;
      s.events.push({ t: 'playerHurt', id: p.id, dmg }, { t: 'freeze', ms: 50 }); if (p.hp <= 0) { p.dead = true; p.hp = 0; } }
  }
} };
