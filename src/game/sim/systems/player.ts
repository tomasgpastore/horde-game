import type { System } from '../system';
import { EMPTY_INPUT } from '@shared/types';
import { PLAYER } from '../content';

/** Movement, aim, dash with i-frames, obstacle + arena collision. */
export const playerSystem: System = { name: 'player', update(s, c) {
  const dt = c.dt;
  for (const p of s.players) {
    if (!p.active || p.dead) continue;
    const inp = c.inputs[p.id] ?? EMPTY_INPUT;
    p.iframes = Math.max(0, p.iframes - dt); p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    let mx = inp.moveX, mz = inp.moveZ; const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
    const moving = l > 0.05;
    if (moving) { p.stats.mdx = mx / l; p.stats.mdz = mz / l; if (l > 1) { p.stats.mdx = mx; p.stats.mdz = mz; } const n = Math.hypot(p.stats.mdx, p.stats.mdz) || 1; p.stats.mdx /= n; p.stats.mdz /= n; }
    // aim -> facing (falls back to move direction)
    if (Math.hypot(inp.aimX, inp.aimZ) > 0.01) p.facing = Math.atan2(inp.aimX, inp.aimZ); else if (moving) p.facing = Math.atan2(mx, mz);

    if (inp.dash && p.dashCooldown <= 0 && p.dashTime <= 0) {
      const dx = moving ? p.stats.mdx : Math.sin(p.facing), dz = moving ? p.stats.mdz : Math.cos(p.facing);
      p.dashTime = PLAYER.dashDur; p.dashCooldown = PLAYER.dashCooldown; p.iframes = Math.max(p.iframes, PLAYER.dashIframes);
      p.vx = dx * PLAYER.dashSpeed; p.vz = dz * PLAYER.dashSpeed; s.events.push({ t: 'dash', id: p.id });
    }
    if (p.dashTime > 0) p.dashTime = Math.max(0, p.dashTime - dt);
    else { const k = Math.min(1, PLAYER.accel * dt), sp = p.stats.moveSpeed; p.vx += (mx * sp - p.vx) * k; p.vz += (mz * sp - p.vz) * k; }
    p.x += p.vx * dt; p.z += p.vz * dt;
    const obs = c.arena.obstacles;
    for (let k = 0; k < obs.length; k++) { const o = obs[k], dx = p.x - o.x, dz = p.z - o.z, min = o.r + PLAYER.radius, d2 = dx * dx + dz * dz;
      if (d2 < min * min) { const d = Math.sqrt(d2) || 0.001; p.x = o.x + dx / d * min; p.z = o.z + dz / d * min; } }
    const d = Math.hypot(p.x, p.z), R = c.arena.radius - 0.5; if (d > R) { p.x *= R / d; p.z *= R / d; }
  }
} };
