import type { System } from '../system';
import { alloc } from '../pools';
import { MAX_ENEMIES } from '@shared/types';
import type { SimState } from '@shared/types';
import { enemyDef } from '../content/enemies';
/** Swarm events every SWARM_EVERY s (from SWARM_START): alternating STAMPEDE LINE (a wall of skitters sweeping in from one side)
 *  and ENCIRCLE (ring of skitters closing in). 30–60 enemies at once, even past the soft alive cap (+80). Deterministic (ctx.rng). */
export const SWARM_START = 20, SWARM_EVERY = 30, SKITTER = 3;
function put(s: SimState, kind: number, x: number, z: number): boolean {
  const e = s.enemies, i = alloc(e.alive, e.count, MAX_ENEMIES); if (i < 0) return false;
  e.alive[i] = 1; e.kind[i] = kind; e.flags[i] = 0; e.x[i] = x; e.z[i] = z; e.vx[i] = e.vz[i] = 0; e.hitFlash[i] = 0; e.facing[i] = 0;
  e.hp[i] = enemyDef(kind).hp * (1 + s.wave * 0.12); if (i >= e.count) e.count = i + 1; return true;
}
export const swarmSystem: System = { name: 'swarms', update(s, c) {
  const n = Math.floor((s.time - SWARM_START) / SWARM_EVERY) + 1;
  if (s.time < SWARM_START || n <= s.swarmCount) return;
  const p = s.players[0]; if (p.dead) return; s.swarmCount = n;
  let alive = 0; const e = s.enemies; for (let i = 0; i < e.count; i++) alive += e.alive[i];
  if (alive > 520) return;
  const count = Math.min(60, 30 + n * 6), R = c.arena.radius - 1.5, fit = (x: number, z: number): [number, number] => { const d = Math.hypot(x, z); return d > R ? [x * R / d, z * R / d] : [x, z]; };
  const a0 = c.rng.range(0, Math.PI * 2);
  if (n % 2 === 1) { // stampede line: perpendicular wall 24u away
    const dx = Math.cos(a0), dz = Math.sin(a0), px = -dz, pz = dx;
    for (let k = 0; k < count; k++) { const o = (k - (count - 1) / 2) * 0.9, [x, z] = fit(p.x + dx * 24 + px * o, p.z + dz * 24 + pz * o); put(s, SKITTER, x, z); }
  } else { // encircle
    for (let k = 0; k < count; k++) { const a = a0 + k / count * Math.PI * 2, [x, z] = fit(p.x + Math.cos(a) * 20, p.z + Math.sin(a) * 20); put(s, SKITTER, x, z); }
  }
} };
