import type { System } from '../system';
import { enemyDef, SPITTER_KIND, SPITTER, HOSTILE, PK_SPIT } from '../content/enemies';
import { alloc } from '../pools';
import { MAX_PROJECTILES } from '@shared/types';
import { resetHit } from './projectiles';
import { head, next, cellX, DIM } from './grid';
/** Chase nearest living player, light separation via grid, contact damage with i-frames, death → gameOver. */
export const enemySystem: System = { name: 'enemies', update(s, c) {
  const e = s.enemies;
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
    let mv = 1;
    if (e.kind[i] === SPITTER_KIND && !tgt.dead) { // hold range: approach beyond holdMax, back off inside holdMin, shoot on a staggered clock
      mv = d > SPITTER.holdMax ? 1 : d < SPITTER.holdMin ? -1 : 0;
      const ph = (s.tick + i * 17) % SPITTER.every;
      if (d < SPITTER.range && ph === SPITTER.every - SPITTER.telegraph) s.events.push({ t: 'shoot', weapon: 'spit_telegraph', x: e.x[i], z: e.z[i], owner: HOSTILE });
      if (d < SPITTER.range && ph === 0) { const pr = s.projectiles, k = alloc(pr.alive, pr.count, MAX_PROJECTILES);
        if (k >= 0) { pr.alive[k] = 1; pr.kind[k] = PK_SPIT; pr.owner[k] = HOSTILE; pr.x[k] = e.x[i]; pr.z[k] = e.z[i]; pr.vx[k] = dx / d * SPITTER.speed; pr.vz[k] = dz / d * SPITTER.speed; pr.life[k] = SPITTER.life; pr.dmg[k] = SPITTER.dmg; pr.pierce[k] = 0; resetHit(k); if (k >= pr.count) pr.count = k + 1;
          s.events.push({ t: 'shoot', weapon: 'spit', x: e.x[i], z: e.z[i], owner: HOSTILE }); } }
    }
    e.vx[i] = dx / d * def.speed * mv + sx * 3; e.vz[i] = dz / d * def.speed * mv + sz * 3;
    e.x[i] += e.vx[i] * c.dt; e.z[i] += e.vz[i] * c.dt; e.facing[i] = Math.atan2(dx, dz);
    if (!tgt.dead && d < def.radius + 0.4 && tgt.iframes <= 0) {
      const dmg = Math.max(1, def.dmg * (e.flags[i] & 1 ? 1.5 : 1) - (tgt.stats.armor ?? 0)); tgt.hp -= dmg; tgt.iframes = 0.6; s.events.push({ t: 'playerHurt', id: tgt.id, dmg }, { t: 'freeze', ms: 50 });
      if (tgt.hp <= 0) { tgt.dead = true; tgt.hp = 0; }
    }
  }
  if (alive && !s.players.some(p => p.active && !p.dead)) { s.phase = 'gameOver'; s.events.push({ t: 'gameOver', victory: false }); }
} };
