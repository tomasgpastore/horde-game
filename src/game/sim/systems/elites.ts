import type { System } from '../system';
import { alloc } from '../pools';
import { MAX_ENEMIES } from '@shared/types';
import { enemyDef } from '../content/enemies';
/** Elites: every ELITE_EVERY seconds (from ELITE_START) a tough enemy (flags bit0) spawns off-screen and hunts the player; it drops a CHEST (pickup kind 1). */
export const ELITE_START = 50, ELITE_EVERY = 40, ELITE_KINDS = [0, 2, 5, 7];
export const eliteSystem: System = { name: 'elites', update(s, c) {
  const n = Math.floor((s.time - ELITE_START) / ELITE_EVERY) + 1;
  if (s.time < ELITE_START || n <= s.eliteCount) return;
  const p = s.players[0]; if (p.dead) return;
  s.eliteCount = n; const e = s.enemies, i = alloc(e.alive, e.count, MAX_ENEMIES); if (i < 0) return;
  const kind = ELITE_KINDS[c.rng.int(ELITE_KINDS.length)], a = c.rng.range(0, Math.PI * 2), R = c.arena.radius - 2;
  let x = p.x + Math.cos(a) * 20, z = p.z + Math.sin(a) * 20; const d = Math.hypot(x, z); if (d > R) { x *= R / d; z *= R / d; }
  e.alive[i] = 1; e.kind[i] = kind; e.flags[i] = 1; e.x[i] = x; e.z[i] = z; e.vx[i] = e.vz[i] = 0; e.hitFlash[i] = 0;
  e.hp[i] = enemyDef(kind).hp * 8 * (1 + s.wave * 0.12); if (i >= e.count) e.count = i + 1;
} };
