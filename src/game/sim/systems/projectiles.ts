import type { System } from '../system';
import { alloc } from '../pools';
import { MAX_PICKUPS, MAX_PROJECTILES } from '@shared/types';
import { head, next, CELL, cellX, DIM } from './grid';
import { enemyDef, PK_SPIT, SPITTER } from '../content/enemies';

const lastHit = new Int16Array(MAX_PROJECTILES).fill(-1);
export const resetHit = (i: number) => { lastHit[i] = -1; };
const PR = 0.3;

export function spawnGem(s: import('@shared/types').SimState, x: number, z: number, value: number, kind = 0) {
  const pk = s.pickups, j = alloc(pk.alive, pk.count, MAX_PICKUPS); if (j < 0) return;
  pk.alive[j] = 1; pk.kind[j] = kind; pk.x[j] = x; pk.z[j] = z; pk.value[j] = value; pk.magnet[j] = 0; if (j >= pk.count) pk.count = j + 1;
}

export function killEnemy(s: import('@shared/types').SimState, j: number) {
  const e = s.enemies, def = enemyDef(e.kind[j]); e.alive[j] = 0; s.kills++; if (e.flags[j] & 1) { spawnGem(s, e.x[j], e.z[j], 0, 1); e.flags[j] = 0; } else spawnGem(s, e.x[j], e.z[j], def.xp);
  s.events.push({ t: 'kill', x: e.x[j], z: e.z[j], enemyKind: e.kind[j] });
}
export const projectileSystem: System = { name: 'projectiles', update(s, c) {
  const pr = s.projectiles, e = s.enemies;
  for (let i = 0; i < pr.count; i++) { if (!pr.alive[i]) continue;
    if (pr.kind[i] === PK_SPIT) { // hostile shot: straight line, hits the first living player not in i-frames
      pr.x[i] += pr.vx[i] * c.dt; pr.z[i] += pr.vz[i] * c.dt; pr.life[i] -= c.dt; if (pr.life[i] <= 0) { pr.alive[i] = 0; continue; }
      for (const p of s.players) { if (!p.active || p.dead) continue; const r = SPITTER.radius + 0.4;
        if ((p.x - pr.x[i]) ** 2 + (p.z - pr.z[i]) ** 2 < r * r) { pr.alive[i] = 0; if (p.iframes <= 0) { const dmg = Math.max(1, pr.dmg[i] - (p.stats.armor ?? 0)); p.hp -= dmg; p.iframes = 0.6;
          s.events.push({ t: 'playerHurt', id: p.id, dmg }, { t: 'freeze', ms: 50 }); if (p.hp <= 0) { p.dead = true; p.hp = 0; } } break; } }
      continue; }
    if (pr.kind[i] !== 0 && pr.kind[i] !== 5) { if (pr.kind[i] !== 1) { pr.life[i] -= c.dt; if (pr.life[i] <= 0) pr.alive[i] = 0; } continue; } // bolt-like kinds (0 bolt, 5 seeker spear) move+collide here; others are driven by weapons.ts
    pr.x[i] += pr.vx[i] * c.dt; pr.z[i] += pr.vz[i] * c.dt; pr.life[i] -= c.dt;
    if (pr.life[i] <= 0) { pr.alive[i] = 0; continue; }
    const gx = cellX(pr.x[i]), gz = cellX(pr.z[i]);
    let dead = false;
    for (let oz = -1; oz <= 1 && !dead; oz++) for (let ox = -1; ox <= 1 && !dead; ox++) {
      const cx = gx + ox, cz = gz + oz; if (cx < 0 || cz < 0 || cx >= DIM || cz >= DIM) continue;
      for (let j = head[cz * DIM + cx]; j >= 0; j = next[j]) {
        if (!e.alive[j] || j === lastHit[i]) continue;
        const def = enemyDef(e.kind[j]), dx = e.x[j] - pr.x[i], dz = e.z[j] - pr.z[i], r = def.radius + PR;
        if (dx * dx + dz * dz > r * r) continue;
        const crit = c.rng.next() < 0.1 + (s.players[pr.owner[i]]?.stats.luck ?? 0), dmg = pr.dmg[i] * (crit ? 2 : 1);
        e.hp[j] -= dmg; e.hitFlash[j] = 0.1; lastHit[i] = j;
        s.events.push({ t: 'hit', x: e.x[j], z: e.z[j], dmg, crit, enemyKind: e.kind[j] });
        if (e.hp[j] <= 0) killEnemy(s, j);
        if (pr.pierce[i] > 0) pr.pierce[i]--; else { pr.alive[i] = 0; dead = true; break; }
      }
    }
  }
} };
