import type { System } from '../system';
import { EMPTY_INPUT } from '@shared/types';
/** STUB (Gameplay Engineer owns): movement, dash, arena clamp, obstacle collision. */
export const playerSystem: System = { name: 'player', update(s, c) {
  for (const p of s.players) {
    if (!p.active || p.dead) continue;
    const inp = c.inputs[p.id] ?? EMPTY_INPUT;
    let mx = inp.moveX, mz = inp.moveZ; const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
    p.vx = mx * p.stats.moveSpeed; p.vz = mz * p.stats.moveSpeed;
    p.x += p.vx * c.dt; p.z += p.vz * c.dt;
    if (l > 0.01) p.facing = Math.atan2(mx, mz);
    const d = Math.hypot(p.x, p.z), R = c.arena.radius - 0.5; if (d > R) { p.x *= R / d; p.z *= R / d; }
  }
} };
