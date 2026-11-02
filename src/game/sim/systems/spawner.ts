import type { System } from '../system';
import { alloc } from '../pools';
import { enemyDef } from '../content/enemies';
import { MAX_ENEMIES } from '@shared/types';
import type { SimState } from '@shared/types';
import { waveFor, waveAt, WAVE_SECONDS, ARENA_BOSS } from '@world/waves';
/** World-owned: wave pacing, off-screen spawn ring, ring surges, boss events. Deterministic (ctx.rng only).
 *  Enemy base stats come from Gameplay; here we only set position/kind/hp placeholder via `spawnHp`. */
export const SPAWN_DIST = 17;

export const spawnHp = (kind: number, wave: number) => enemyDef(kind).hp * (1 + wave * 0.12);

function spawnOne(s: SimState, kind: number, x: number, z: number): boolean {
  const e = s.enemies, i = alloc(e.alive, e.count, MAX_ENEMIES);
  if (i < 0) return false;
  e.alive[i] = 1; e.kind[i] = kind; e.flags[i] = 0; e.x[i] = x; e.z[i] = z; e.vx[i] = 0; e.vz[i] = 0;
  e.hp[i] = spawnHp(kind, s.wave); e.hitFlash[i] = 0; e.facing[i] = 0;
  if (i >= e.count) e.count = i + 1;
  return true;
}
export const spawner: System = { name: 'spawner', update(s, c) {
  const a = s.spawner; let aliveCount = 0;
  const grace = s.biome > 0 ? Math.min(1, 0.4 + (s.time - s.biomeT0) / 80) : 1; // new biome: the horde ramps back up over ~50s (breathing room after the boss)
  const wave = waveAt(s.time), def = waveFor(wave), R = c.arena.radius;
  if (wave !== a.lastWave) { a.lastWave = wave; s.wave = wave; s.events.push({ t: 'waveStart', wave });
  }
  const bd = ARENA_BOSS[c.arena.id];
  if (bd && !a.boss && s.time >= s.biomeT0 + bd.time) { a.boss = true; const ang = c.rng.range(0, Math.PI * 2);
    const hp = s.players[0]; let bx = hp.x + Math.cos(ang) * 13, bz = hp.z + Math.sin(ang) * 13; const bd2 = Math.hypot(bx, bz); if (bd2 > R - 3) { bx *= (R - 3) / bd2; bz *= (R - 3) / bd2; } // boss arrives ~13u from the hero, IN VIEW (was the arena rim = off-screen)
    s.events.push({ t: 'bossSpawn', x: bx, z: bz, bossId: bd.bossId }); }
  // alive count
  const e = s.enemies; for (let i = 0; i < e.count; i++) aliveCount += e.alive[i];
  // players to target
  const act: number[] = []; for (const p of s.players) if (p.active && !p.dead) act.push(p.id);
  if (!act.length) return;
  const sampleKind = () => { let t = 0; for (const m of def.mix) t += m.weight; let r = c.rng.next() * t;
    for (const m of def.mix) { r -= m.weight; if (r <= 0) return m.kind; } return def.mix[0].kind; };
  const place = (p: { x: number; z: number }, ang: number, dist: number): [number, number] => {
    let x = p.x + Math.cos(ang) * dist, z = p.z + Math.sin(ang) * dist; const d = Math.hypot(x, z), lim = R - 1.5;
    if (d > lim) { x *= lim / d; z *= lim / d; } return [x, z];
  };
  // continuous trickle (slightly ramped inside the wave so it breathes)
  const phase = (s.time % WAVE_SECONDS) / WAVE_SECONDS;
  a.budget += def.rate * (0.8 + 0.4 * phase) * (s.boss ? 0.12 : 1) * c.dt; // boss fight: normal spawns drop to 35% (Designer BOSS_RULES) so the boss is the main threat
  while (a.budget >= 1) { a.budget -= 1; if (aliveCount >= (s.boss ? def.cap * 0.4 : def.cap) * grace) { a.budget = Math.min(a.budget, 2); break; }
    const p = s.players[c.rng.pick(act)], [x, z] = place(p, c.rng.range(0, Math.PI * 2), (s.time < 40 ? 12 : SPAWN_DIST) + c.rng.range(0, 4)); // first 40s: spawn close = constant contact
    if (spawnOne(s, sampleKind(), x, z)) aliveCount++; }
  // opening pack: 8 husks arrive from one side at 3s so the very first seconds already have contact (Creative Director pacing)
  if (!a.opener && s.time >= 3) { a.opener = true; const p = s.players[act[0]], off = c.rng.range(0, Math.PI * 2); for (let j = 0; j < 8; j++) { const [x, z] = place(p, off + (j - 3.5) * 0.18, 13); if (spawnOne(s, 0, x, z)) aliveCount++; } }
  // ring surge around a player: forces movement
  if (def.surge && s.time >= a.nextSurge && !s.boss) { a.nextSurge = s.time + def.surge.every;
    const p = s.players[c.rng.pick(act)], n = def.surge.count, k = sampleKind(), off = c.rng.range(0, Math.PI * 2);
    for (let j = 0; j < n && aliveCount < def.cap + 40; j++) { const [x, z] = place(p, off + j / n * Math.PI * 2, 16); if (spawnOne(s, k, x, z)) aliveCount++; } }
} };
