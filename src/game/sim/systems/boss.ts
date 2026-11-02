import type { System } from '../system';
import { alloc } from '../pools';
import { MAX_ENEMIES } from '@shared/types';
import { BOSSES, BOSS_KIND } from '../content/enemies';
import { spawnGem } from './projectiles';
import { NEXT_ARENA } from '@world/waves';
/** Boss encounter: spawns on 'bossSpawn' (emitted by World's spawner), chase → red telegraph → charge cycle, death → bossDeath + victory. */
export const bossSystem: System = { name: 'boss', update(s, c) {
  const e = s.enemies, p = s.players[0];
  if (!s.boss) {
    for (const ev of s.events) if (ev.t === 'bossSpawn' && BOSSES[ev.bossId]) {
      const i = alloc(e.alive, e.count, MAX_ENEMIES); if (i < 0) break; const d = BOSSES[ev.bossId];
      e.alive[i] = 1; e.kind[i] = BOSS_KIND; e.flags[i] = 0; e.x[i] = ev.x; e.z[i] = ev.z; e.vx[i] = e.vz[i] = 0; e.hp[i] = d.hp; e.hitFlash[i] = 0; if (i >= e.count) e.count = i + 1;
      s.boss = { idx: i, id: ev.bossId, maxHp: d.hp, t: 0, mode: 0, dx: 0, dz: 1 }; break;
    }
    return;
  }
  const b = s.boss, i = b.idx, d = BOSSES[b.id];
  if (!e.alive[i] || e.kind[i] !== BOSS_KIND) { // killed
    s.events.push({ t: 'bossDeath', x: e.x[i], z: e.z[i], bossId: b.id }, { t: 'freeze', ms: 120 });
    for (let k = 0; k < 12; k++) spawnGem(s, e.x[i] + Math.cos(k) * 1.2, e.z[i] + Math.sin(k) * 1.2, 5);
    const next = NEXT_ARENA[c.arena.id]; s.boss = null;
    if (next) { s.events.push({ t: 'biome', next }); s.bossReward = true; p.xp = p.xpToNext; p.hp = Math.min(p.maxHp, p.hp + 40); } // reward card (evolution) then the client swaps biome
    else { s.phase = 'gameOver'; s.events.push({ t: 'gameOver', victory: true }); }
    return;
  }
  b.t += c.dt; const dx = p.x - e.x[i], dz = p.z - e.z[i], dist = Math.hypot(dx, dz) || 1;
  if (b.mode === 0) { e.x[i] += dx / dist * d.speed * c.dt; e.z[i] += dz / dist * d.speed * c.dt; e.facing[i] = Math.atan2(dx, dz);
    if (b.t > d.cd) { b.mode = 1; b.t = 0; s.events.push({ t: 'bossTelegraph', x: e.x[i], z: e.z[i], dx: dx / dist, dz: dz / dist, windup: d.windup, bossId: b.id }); } }
  else if (b.mode === 1) { b.dx = dx / dist; b.dz = dz / dist; e.facing[i] = Math.atan2(dx, dz); // telegraph tracks target, then locks
    if (b.t > d.windup) { b.mode = 2; b.t = 0; } }
  else { e.x[i] += b.dx * d.charge * c.dt; e.z[i] += b.dz * d.charge * c.dt; if (b.t > 0.55) { b.mode = 0; b.t = 0; s.events.push({ t: 'bossSlam', x: e.x[i], z: e.z[i], bossId: b.id }, { t: 'freeze', ms: 40 }); } }
} };
