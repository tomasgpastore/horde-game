import type { System } from '../system';
import { rollChoices } from '../content/upgrades';
/** Pickup magnet/collect + XP → level-up. Also called by Sim.choose() to chain level-ups. */
export const pickupSystem: System = { name: 'pickups', update(s, c) {
  const pk = s.pickups, p = s.players[0];
  if (!p.dead) for (let i = 0; i < pk.count; i++) { if (!pk.alive[i]) continue;
    const dx = p.x - pk.x[i], dz = p.z - pk.z[i], d = Math.hypot(dx, dz);
    if (!pk.magnet[i] && d < p.stats.pickupRadius * (pk.kind[i] === 1 ? 3 : 1)) pk.magnet[i] = 1;
    if (pk.magnet[i]) { const sp = 14 + 10 / (d + 0.5); pk.x[i] += dx / (d || 1) * sp * c.dt; pk.z[i] += dz / (d || 1) * sp * c.dt; }
    if (d < 0.7) { pk.alive[i] = 0; if (pk.kind[i] === 1) { p.xp += p.xpToNext - p.xp; p.hp = Math.min(p.maxHp, p.hp + 25); } else p.xp += pk.value[i]; s.events.push({ t: 'pickup', kind: pk.kind[i], id: p.id }); }
  }
  if (p.xp >= p.xpToNext && s.phase === 'running') {
    p.xp -= p.xpToNext; p.level++; p.xpToNext = Math.round(5 + p.level * 4 + p.level * p.level * 0.4);
    s.levelChoices = rollChoices(p, c.rng); s.phase = 'levelUp';
    s.events.push({ t: 'levelUp', id: p.id, choices: s.levelChoices.slice() }, { t: 'slow', scale: 0.3, secs: 0.4 });
  }
} };
