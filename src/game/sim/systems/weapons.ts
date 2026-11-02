import type { System } from '../system';
import { alloc } from '../pools';
import { MAX_PROJECTILES } from '@shared/types';
import { WEAPONS, boltCount, levelDmg, levelCd, levelPierce } from '../content/weapons';
import { resetHit } from './projectiles';

export const weaponSystem: System = { name: 'weapons', update(s, c) {
  const e = s.enemies, pr = s.projectiles;
  for (const p of s.players) {
    if (!p.active || p.dead) continue;
    const inp = c.inputs[p.id];
    for (const w of p.weapons) {
      w.cooldown -= c.dt; if (w.cooldown > 0) continue;
      const def = WEAPONS[w.id]; if (!def) continue;
      // auto-aim: nearest enemy in range, else manual aim
      let best = def.range * def.range, bx = 0, bz = 0, found = false;
      for (let i = 0; i < e.count; i++) { if (!e.alive[i]) continue;
        const dx = e.x[i] - p.x, dz = e.z[i] - p.z, d = dx * dx + dz * dz; if (d < best) { best = d; bx = dx; bz = dz; found = true; } }
      if (!found) { w.cooldown = 0.05; continue; }
      w.cooldown = def.cooldown * levelCd(w.level) * p.stats.cooldownMult;
      const base = Math.atan2(bz, bx), n = boltCount(w.level);
      for (let k = 0; k < n; k++) {
        const a = base + (k - (n - 1) / 2) * 0.16, i = alloc(pr.alive, pr.count, MAX_PROJECTILES); if (i < 0) break;
        pr.alive[i] = 1; pr.kind[i] = 0; pr.owner[i] = p.id; pr.x[i] = p.x; pr.z[i] = p.z;
        pr.vx[i] = Math.cos(a) * def.speed; pr.vz[i] = Math.sin(a) * def.speed; pr.life[i] = def.life;
        pr.dmg[i] = def.dmg * levelDmg(w.level) * p.stats.damageMult; pr.pierce[i] = def.pierce + levelPierce(w.level);
        resetHit(i); if (i >= pr.count) pr.count = i + 1;
      }
      s.events.push({ t: 'shoot', weapon: w.id, x: p.x, z: p.z, owner: p.id });
    }
  }
} };
