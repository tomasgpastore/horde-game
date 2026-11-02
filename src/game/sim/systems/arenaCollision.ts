import type { System } from '../system';
/** World-owned: clamp to arena radius and push out of circle obstacles. Runs after movement systems. */
export const arenaCollision: System = { name: 'arenaCollision', update(s, c) {
  const { radius, obstacles } = c.arena, n = obstacles.length;
  const fix = (x: number, z: number, pr: number, out: [number, number]) => {
    for (let k = 0; k < n; k++) { const o = obstacles[k], dx = x - o.x, dz = z - o.z, min = o.r + pr, d2 = dx * dx + dz * dz;
      if (d2 < min * min) { const d = Math.sqrt(d2) || 0.001; x = o.x + dx / d * min; z = o.z + dz / d * min; } }
    const d = Math.hypot(x, z), lim = radius - pr; if (d > lim) { x *= lim / d; z *= lim / d; }
    out[0] = x; out[1] = z;
  };
  const o: [number, number] = [0, 0];
  for (const p of s.players) { if (!p.active) continue; fix(p.x, p.z, 0.4, o); p.x = o[0]; p.z = o[1]; }
  const e = s.enemies;
  for (let i = 0; i < e.count; i++) { if (!e.alive[i]) continue; fix(e.x[i], e.z[i], 0.4, o); e.x[i] = o[0]; e.z[i] = o[1]; }
} };
