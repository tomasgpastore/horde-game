import type { System } from '../system';
import { alloc } from '../pools';
import { enemyDef } from '../content/enemies';
import { MAX_ENEMIES } from '@shared/types';
import type { SimState } from '@shared/types';
import { waveFor, waveAt, WAVE_SECONDS, ARENA_BOSS } from '@world/waves';
/** World-owned: wave pacing, off-screen spawn ring, ring surges, boss events. Deterministic (ctx.rng only).
 *  Enemy base stats come from Gameplay; here we only set position/kind/hp placeholder via `spawnHp`. */
export const SPAWN_DIST = 24;

export const spawnHp = (kind: number, wave: number) => enemyDef(kind).hp * (1 + wave * 0.12);

function spawnOne(s: SimState, kind: number, x: number, z: number): boolean {
  const e = s.enemies, i = alloc(e.alive, e.count, MAX_ENEMIES);
  if (i < 0) return false;
  e.alive[i] = 1; e.kind[i] = kind; e.x[i] = x; e.z[i] = z; e.vx[i] = 0; e.vz[i] = 0;
  e.hp[i] = spawnHp(kind, s.wave); e.hitFlash[i] = 0; e.facing[i] = 0;
  if (i >= e.count) e.count = i + 1;
  return true;
}
export const spawner: System = { name: 'spawner', update(s, c) {
  const a = s.spawner; let aliveCount = 0;
  const wave = waveAt(s.time), def = waveFor(wave), R = c.arena.radius;
  if (wave !== a.lastWave) { a.lastWave = wave; s.wave = wave; s.events.push({ t: 'waveStart', wave });
  }
  const bd = ARENA_BOSS[c.arena.id];
  if (bd && !a.boss && s.time >= bd.time) { a.boss = true; const ang = c.rng.range(0, Math.PI * 2);
    s.events.push({ t: 'bossSpawn', x: Math.cos(ang) * (R - 4), z: Math.sin(ang) * (R - 4), bossId: bd.bossId }); }
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
  a.budget += def.rate * (0.8 + 0.4 * phase) * c.dt;
  while (a.budget >= 1) { a.budget -= 1; if (aliveCount >= def.cap) { a.budget = Math.min(a.budget, 2); break; }
    const p = s.players[c.rng.pick(act)], [x, z] = place(p, c.rng.range(0, Math.PI * 2), SPAWN_DIST + c.rng.range(0, 4));
    if (spawnOne(s, sampleKind(), x, z)) aliveCount++; }
  // ring surge around a player: forces movement
  if (def.surge && s.time >= a.nextSurge) { a.nextSurge = s.time + def.surge.every;
    const p = s.players[c.rng.pick(act)], n = def.surge.count, k = sampleKind(), off = c.rng.range(0, Math.PI * 2);
    for (let j = 0; j < n && aliveCount < def.cap + 40; j++) { const [x, z] = place(p, off + j / n * Math.PI * 2, 16); if (spawnOne(s, k, x, z)) aliveCount++; } }
} };
