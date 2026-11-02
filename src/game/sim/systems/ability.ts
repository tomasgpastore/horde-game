import type { System } from '../system';
import { EMPTY_INPUT } from '@shared/types';
import { ABILITY } from '../content/balance';
import { enemyDef, BOSS_KIND } from '../content/enemies';
import { killEnemy } from './projectiles';
/** Ember Burst (key E / gamepad X): radius burst, damage + knockback, clears hostile projectiles. Cooldown in p.stats.abilityCd (seconds left; HUD reads it).
 *  Emits {t:'shoot', weapon:'ember_burst'} for render/audio (+ freeze). */
/** Launch scope: Ember Burst is OFF (Studio Head decision). Flip to true to re-enable E / gamepad X. */
export const ABILITY_ENABLED = false;
export const abilitySystem: System = { name: 'ability', update(s, c) {
  if (!ABILITY_ENABLED) return;
  const e = s.enemies;
  for (const p of s.players) {
    if (!p.active || p.dead) continue;
    let cd = p.stats.abilityCd ?? 0; if (cd > 0) { cd = Math.max(0, cd - c.dt); p.stats.abilityCd = cd; }
    if (!(c.inputs[p.id] ?? EMPTY_INPUT).ability || cd > 0) continue;
    p.stats.abilityCd = ABILITY.cooldown;
    const R = ABILITY.radius * (p.stats.area || 1), dmg = ABILITY.damage * (p.stats.damageMult || 1);
    for (let j = 0; j < e.count; j++) { if (!e.alive[j]) continue;
      const dx = e.x[j] - p.x, dz = e.z[j] - p.z, d = Math.hypot(dx, dz), r = R + enemyDef(e.kind[j]).radius; if (d > r) continue;
      e.hp[j] -= dmg; e.hitFlash[j] = 0.15;
      if (e.kind[j] !== BOSS_KIND) { const push = ABILITY.knockback * (1 - d / r * 0.5), n = d || 1; e.x[j] += (d ? dx / n : 1) * push; e.z[j] += (d ? dz / n : 0) * push; }
      s.events.push({ t: 'hit', x: e.x[j], z: e.z[j], dmg, crit: false, enemyKind: e.kind[j] });
      if (e.hp[j] <= 0) killEnemy(s, j);
    }
    if (ABILITY.clearsEnemyProjectiles) { const pr = s.projectiles; for (let i = 0; i < pr.count; i++) if (pr.alive[i] && pr.owner[i] === HOSTILE) pr.alive[i] = 0; }
    s.events.push({ t: 'shoot', weapon: 'ember_burst', x: p.x, z: p.z, owner: p.id }, { t: 'freeze', ms: 60 });
  }
} };
const HOSTILE = 255; // projectile owner id for enemy shots (see spitter)
