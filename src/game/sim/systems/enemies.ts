import type { System } from '../system';
import { alloc } from '../pools';
import { MAX_ENEMIES } from '@shared/types';
/** STUB (Gameplay + World): spawns a placeholder swarm that chases player 0 so perf/render can be tested from minute 0. */
export const enemySystem: System = { name: 'enemies', update(s, c) {
  const e = s.enemies, p = s.players[0];
  for (let i = 0; i < e.count; i++) { if (!e.alive[i]) continue;
    const dx = p.x - e.x[i], dz = p.z - e.z[i], d = Math.hypot(dx, dz) || 1, sp = 2.5;
    e.vx[i] = dx / d * sp; e.vz[i] = dz / d * sp; e.x[i] += e.vx[i] * c.dt; e.z[i] += e.vz[i] * c.dt; e.facing[i] = Math.atan2(dx, dz);
  }
} };
