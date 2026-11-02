import type { System } from '../system';
import { alloc } from '../pools';
import { MAX_ENEMIES } from '@shared/types';
import { BOSSES, BOSS_KIND, bossPhase } from '../content/enemies';
import { MAX_PROJECTILES } from '@shared/types';
import { shotKind } from './spitters';
import { spawnHp } from './spawner';
import { spawnGem } from './projectiles';
import { BOSS_HIT_RADIUS } from '../radius';
import { NEXT_ARENA } from '@world/waves';
/** Boss encounter: spawns on 'bossSpawn' (emitted by World's spawner), chase → red telegraph → charge cycle, death → bossDeath + victory. */
export const bossSystem: System = { name: 'boss', update(s, c) {
  const e = s.enemies, p = s.players[0];
  if (!s.boss) {
    for (const ev of s.events) if (ev.t === 'bossSpawn' && BOSSES[ev.bossId]) {
      const i = alloc(e.alive, e.count, MAX_ENEMIES); if (i < 0) break; const d = BOSSES[ev.bossId];
      e.alive[i] = 1; e.kind[i] = BOSS_KIND; e.flags[i] = 0; e.x[i] = ev.x; e.z[i] = ev.z; e.vx[i] = e.vz[i] = 0; e.hp[i] = d.hp; e.hitFlash[i] = 0; if (i >= e.count) e.count = i + 1;
      // readability: the arena around the boss's entrance is cleared of minions (they scatter away) so the boss is never buried
      for (let j = 0; j < e.count; j++) if (e.alive[j] && j !== i && !(e.flags[j] & 1) && Math.hypot(e.x[j] - ev.x, e.z[j] - ev.z) < 9) e.alive[j] = 0;
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
  { const lx = p.x - e.x[i], lz = p.z - e.z[i], ld = Math.hypot(lx, lz); if (ld > 17 && b.mode !== 2) { const k = 14 / ld; e.x[i] = p.x - lx * k; e.z[i] = p.z - lz * k; } } // leash: boss never strays beyond ~17u of the hero
  // minions keep a clear halo around the boss body (soft push-out) so the model stays readable in the swarm
  { const R = (BOSS_HIT_RADIUS[b.id] ?? 1.76) + 1.6; for (let j = 0; j < e.count; j++) { if (!e.alive[j] || j === i) continue; const ox = e.x[j] - e.x[i], oz = e.z[j] - e.z[i], od = Math.hypot(ox, oz); if (od < R && od > 1e-4) { const k = (R - od) * 6 * c.dt / od; e.x[j] += ox * k; e.z[j] += oz * k; } } }
  b.t += c.dt; const ph = bossPhase(b.id, e.hp[i] / b.maxHp), spd = d.speed * ph.speedMult;
  if (ph.summon && s.time % ph.summon.everyS < c.dt) for (let k = 0; k < ph.summon.count; k++) { const j = alloc(e.alive, e.count, MAX_ENEMIES); if (j < 0) break; const a = k / ph.summon.count * Math.PI * 2 + c.rng.range(0, 0.5);
    e.alive[j] = 1; e.kind[j] = ph.summon.kind; e.flags[j] = 0; e.x[j] = e.x[i] + Math.cos(a) * 3; e.z[j] = e.z[i] + Math.sin(a) * 3; e.vx[j] = e.vz[j] = 0; e.hp[j] = spawnHp(ph.summon.kind, s.wave); e.hitFlash[j] = 0; if (j >= e.count) e.count = j + 1; }
  const dx = p.x - e.x[i], dz = p.z - e.z[i], dist = Math.hypot(dx, dz) || 1;
  if (b.mode === 0) { e.x[i] += dx / dist * spd * c.dt; e.z[i] += dz / dist * spd * c.dt; e.facing[i] = Math.atan2(dx, dz);
    if (b.t > d.cd * ph.cdMult) { b.mode = 1; b.t = 0; s.events.push({ t: 'bossTelegraph', x: e.x[i], z: e.z[i], dx: dx / dist, dz: dz / dist, windup: d.windup, bossId: b.id }); } }
  else if (b.mode === 1) { b.dx = dx / dist; b.dz = dz / dist; e.facing[i] = Math.atan2(dx, dz); // telegraph tracks target, then locks
    if (b.t > d.windup) { b.mode = 2; b.t = 0; } }
  else { e.x[i] += b.dx * d.charge * c.dt; e.z[i] += b.dz * d.charge * c.dt; if (b.t > 0.55) { b.mode = 0; b.t = 0; s.events.push({ t: 'bossSlam', x: e.x[i], z: e.z[i], bossId: b.id }, { t: 'freeze', ms: 40 });
    if (ph.burst) { const pr = s.projectiles, o = c.rng.range(0, Math.PI * 2); for (let k = 0; k < ph.burst.count; k++) { const q = alloc(pr.alive, pr.count, MAX_PROJECTILES); if (q < 0) break; const a = o + k / ph.burst.count * Math.PI * 2;
      pr.alive[q] = 1; pr.kind[q] = shotKind; pr.owner[q] = 255; pr.x[q] = e.x[i]; pr.z[q] = e.z[i]; pr.vx[q] = Math.cos(a) * ph.burst.speed; pr.vz[q] = Math.sin(a) * ph.burst.speed; pr.life[q] = ph.burst.life; pr.dmg[q] = ph.burst.dmg; pr.pierce[q] = 0; if (q >= pr.count) pr.count = q + 1; } } } }
} };
