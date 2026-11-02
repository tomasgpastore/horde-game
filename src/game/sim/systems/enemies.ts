import type { System } from '../system';
import { ENEMY_SCALING } from '../content/balance';
import { enemyDef } from '../content/enemies';
import { head, next, cellX, DIM } from './grid';
import { SPITTER, HOLD, spitTele } from './spitters';
/** Chase nearest living player, light separation via grid, contact damage with i-frames, death → gameOver. */
export const enemySystem: System = { name: 'enemies', update(s, c) {
  const e = s.enemies, mins = Math.max(0, s.time / 60 - 1), /* scaling starts at 1:00 so the opening stays as tuned */ speedMult = ENEMY_SCALING.speedMult(mins), dmgMult = ENEMY_SCALING.dmgMult(mins); // Designer time scaling (hp is wave-scaled in spawner)
  let tgt = s.players[0]; // TODO coop: nearest player
  const alive = s.players.some(p => p.active && !p.dead);
  for (const p of s.players) { if (p.iframes > 0) p.iframes -= c.dt; }
  for (let i = 0; i < e.count; i++) { if (!e.alive[i]) continue;
    const def = enemyDef(e.kind[i]); if (e.hitFlash[i] > 0) e.hitFlash[i] -= c.dt;
    const dx = tgt.x - e.x[i], dz = tgt.z - e.z[i], d = Math.hypot(dx, dz) || 1;
    let sx = 0, sz = 0; const gx = cellX(e.x[i]), gz = cellX(e.z[i]);
    for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
      const cx = gx + ox, cz = gz + oz; if (cx < 0 || cz < 0 || cx >= DIM || cz >= DIM) continue;
      for (let j = head[cz * DIM + cx], n = 0; j >= 0 && n < 6; j = next[j], n++) { if (j === i || !e.alive[j]) continue;
        const ax = e.x[i] - e.x[j], az = e.z[i] - e.z[j], r = def.radius + enemyDef(e.kind[j]).radius, d2 = ax * ax + az * az;
        if (d2 < r * r && d2 > 1e-6) { const dd = Math.sqrt(d2), f = (r - dd) / r; sx += ax / dd * f; sz += az / dd * f; } }
    }
    const sp = e.kind[i] === SPITTER ? (spitTele[i] > 0 || d < HOLD ? 0 : def.speed) : def.speed; // spitters hold position at range and while winding up
    e.vx[i] = dx / d * sp * speedMult + sx * 3; e.vz[i] = dz / d * sp * speedMult + sz * 3;
    e.x[i] += e.vx[i] * c.dt; e.z[i] += e.vz[i] * c.dt; e.facing[i] = Math.atan2(dx, dz);
    if (!tgt.dead && d < def.radius + 0.4 && tgt.iframes <= 0) {
      const dmg = Math.max(1, def.dmg * dmgMult * (e.flags[i] & 1 ? 1.5 : 1) - (tgt.stats.armor ?? 0)); tgt.hp -= dmg; tgt.iframes = 0.6; s.events.push({ t: 'playerHurt', id: tgt.id, dmg }, { t: 'freeze', ms: 50 });
      if (tgt.hp <= 0) { tgt.dead = true; tgt.hp = 0; }
    }
  }
  if (alive && !s.players.some(p => p.active && !p.dead)) { s.phase = 'gameOver'; s.events.push({ t: 'gameOver', victory: false }); }
} };
