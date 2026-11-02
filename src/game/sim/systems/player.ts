import type { System } from '../system';
import { EMPTY_INPUT } from '@shared/types';
export const DASH = { time: 0.16, speedMult: 3.6, cooldown: 1.1, iframes: 0.32 };
/** Movement + dash (i-frames). Arena/obstacle clamping is handled by arenaCollision (World). */
export const playerSystem: System = { name: 'player', update(s, c) {
  for (const p of s.players) {
    if (!p.active || p.dead) continue;
    const inp = c.inputs[p.id] ?? EMPTY_INPUT;
    let mx = inp.moveX, mz = inp.moveZ; const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
    if (p.dashCooldown > 0) p.dashCooldown -= c.dt;
    if (inp.dash && p.dashCooldown <= 0 && p.dashTime <= 0) {
      p.dashTime = DASH.time; p.dashCooldown = DASH.cooldown; p.iframes = Math.max(p.iframes, DASH.iframes);
      if (l < 0.01) { mx = Math.sin(p.facing); mz = Math.cos(p.facing); } // dash in facing dir when standing still
      p.vx = mx * p.stats.moveSpeed * DASH.speedMult; p.vz = mz * p.stats.moveSpeed * DASH.speedMult;
      s.events.push({ t: 'dash', id: p.id });
    }
    if (p.dashTime > 0) { p.dashTime -= c.dt; } else { p.vx = mx * p.stats.moveSpeed; p.vz = mz * p.stats.moveSpeed; }
    p.x += p.vx * c.dt; p.z += p.vz * c.dt;
    if (l > 0.01 && p.dashTime <= 0) p.facing = Math.atan2(mx, mz);
  }
} };
