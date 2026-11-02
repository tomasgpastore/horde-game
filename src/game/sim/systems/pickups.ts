import type { System, SimCtx } from '../system';
import type { SimState, PlayerState } from '@shared/types';
import { PU, PLAYER, xpToNext, rollChoices, applyChoice } from '../content';

/** Gems/gold/health/chests: magnet + collect + xp -> level-up; also death/gameOver check. */
export const pickupSystem: System = { name: 'pickups', update(s, c) {
  const pk = s.pickups, dt = c.dt;
  for (let i = 0; i < pk.count; i++) {
    if (!pk.alive[i]) continue;
    let tp: PlayerState | null = null, bd = 1e12;
    for (const p of s.players) { if (!p.active || p.dead) continue; const d = (p.x - pk.x[i]) ** 2 + (p.z - pk.z[i]) ** 2; if (d < bd) { bd = d; tp = p; } }
    if (!tp) break;
    const d = Math.sqrt(bd);
    if (!pk.magnet[i] && d < tp.stats.pickupRadius) pk.magnet[i] = 1;
    if (pk.magnet[i] && d > 0.001) { const sp = PLAYER.magnetSpeed + Math.max(0, tp.stats.moveSpeed - 6) * 1.5, st = Math.min(d, sp * dt); pk.x[i] += (tp.x - pk.x[i]) / d * st; pk.z[i] += (tp.z - pk.z[i]) / d * st; }
    if (d < PLAYER.collectRadius) {
      pk.alive[i] = 0;
      switch (pk.kind[i]) {
        case PU.XP: tp.xp += pk.value[i]; break;
        case PU.GOLD: s.gold += pk.value[i]; break;
        case PU.HEALTH: tp.hp = Math.min(tp.maxHp, tp.hp + pk.value[i]); break;
        case PU.CHEST: if (!tp.choices.length) tp.choices = rollChoices(tp, c.rng); break;
      }
      s.events.push({ t: 'pickup', kind: pk.kind[i], id: tp.id });
    }
  }
  let alive = 0;
  for (const p of s.players) {
    if (!p.active) continue;
    if (!p.dead) alive++;
    if (p.dead) continue;
    while (p.xp >= p.xpToNext && !p.choices.length) { p.xp -= p.xpToNext; p.level++; p.xpToNext = xpToNext(p.level); p.choices = rollChoices(p, c.rng); }
    if (p.choices.length) s.events.push({ t: 'levelUp', id: p.id, choices: p.choices.slice() });
  }
  if (s.players.some(p => p.active && p.choices.length)) s.phase = 'levelUp';
  if (!alive) { s.phase = 'gameOver'; s.events.push({ t: 'gameOver', victory: false }); }
} };

/** While phase==='levelUp': apply picks from inputs (deterministic, netcode-friendly). Resumes when nobody has pending choices. */
export function resolvePicks(s: SimState, c: SimCtx) {
  for (const p of s.players) {
    if (!p.active || !p.choices.length) continue;
    const pick = c.inputs[p.id]?.pick;
    if (pick === undefined || pick < 0 || pick >= p.choices.length) continue;
    applyChoice(p, p.choices[pick]); p.choices = [];
    while (p.xp >= p.xpToNext) { p.xp -= p.xpToNext; p.level++; p.xpToNext = xpToNext(p.level); p.choices = rollChoices(p, c.rng); s.events.push({ t: 'levelUp', id: p.id, choices: p.choices.slice() }); break; }
  }
  if (!s.players.some(p => p.active && p.choices.length)) s.phase = 'running';
}
