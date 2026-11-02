import type { System } from '../system';
import { ENEMIES, ELITE, MAX_ENEMY_RADIUS, SPAWNS, SPAWN_DIST, WAVE_LEN, VICTORY_TIME, spawnCum, aliveCap, hpScale, eliteChance, PK, HOSTILE } from '../content';
import { rebuild, query, near } from './spatial';
import { spawnEnemy, spawnProjectile, hurtPlayer } from './combat';

/** Wave director + enemy AI + separation + contact damage. */
export const enemySystem: System = { name: 'enemies', update(s, c) {
  const e = s.enemies, dt = c.dt, t = s.time, R = c.arena.radius;
  rebuild(e, R);
  // ---- victory / waves
  const wave = Math.floor(t / WAVE_LEN) + 1;
  if (wave !== s.wave) { s.wave = wave; s.events.push({ t: 'waveStart', wave }); }
  if (t >= VICTORY_TIME) { s.phase = 'gameOver'; s.events.push({ t: 'gameOver', victory: true }); return; }
  // ---- spawning (accumulator is derived from tick so Sim stays a pure function of state)
  const alive = aliveCountFast(s);
  const cap = aliveCap(t);
  const before = Math.floor(spawnCum(t - dt)), after = Math.floor(spawnCum(t));
  let toSpawn = after - before; if (alive + toSpawn > cap) toSpawn = Math.max(0, cap - alive);
  const tgt = firstAlive(s);
  if (tgt) while (toSpawn > 0) {
    let total = 0; for (const sp of SPAWNS) if (t >= sp.from && t < sp.to) total += sp.weight;
    let r = c.rng.next() * total, pick = SPAWNS[0];
    for (const sp of SPAWNS) if (t >= sp.from && t < sp.to) { r -= sp.weight; if (r <= 0) { pick = sp; break; } }
    const ang = c.rng.range(0, 6.2832), dist = c.rng.range(SPAWN_DIST[0], SPAWN_DIST[1]);
    const n = pick.pack ?? 1, elite = n === 1 && c.rng.next() < eliteChance(t);
    for (let k = 0; k < n; k++) {
      let x = tgt.x + Math.cos(ang) * dist + (k ? c.rng.range(-1.5, 1.5) : 0), z = tgt.z + Math.sin(ang) * dist + (k ? c.rng.range(-1.5, 1.5) : 0);
      const d = Math.hypot(x, z), lim = R - 1; if (d > lim) { x *= lim / d; z *= lim / d; }
      spawnEnemy(s, pick.kind, x, z, hpScale(t), elite, c.rng.range(0.5, 2.5));
    }
    toSpawn -= n;
  }
  // ---- AI
  const obs = c.arena.obstacles, P = s.players, k = 1 - Math.exp(-8 * dt);
  for (let i = 0; i < e.count; i++) {
    if (!e.alive[i]) continue;
    const def = ENEMIES[e.kind[i]], elite = e.elite[i] === 1, rad = def.radius * (elite ? ELITE.radiusMult : 1);
    let tp = null as typeof P[0] | null, bd = 1e12;
    for (let q = 0; q < P.length; q++) { const p = P[q]; if (!p.active || p.dead) continue; const d2 = (p.x - e.x[i]) ** 2 + (p.z - e.z[i]) ** 2; if (d2 < bd) { bd = d2; tp = p; } }
    if (!tp) continue;
    const dx = tp.x - e.x[i], dz = tp.z - e.z[i], d = Math.sqrt(bd) || 0.001, nx = dx / d, nz = dz / d;
    let spd = def.speed * (elite ? ELITE.speedMult : 1); if (e.slow[i] > 0) { e.slow[i] -= dt; spd *= 0.4; }
    let ax = nx, az = nz;
    switch (def.ai) {
      case 'erratic': { const a = Math.sin(t * 7 + i * 1.7) * 1.0, cs = Math.cos(a), sn = Math.sin(a); ax = nx * cs - nz * sn; az = nx * sn + nz * cs; break; }
      case 'circle': { const side = (i & 1) ? 1 : -1, w = Math.min(1, Math.max(0.15, (d - 3) / 8)); ax = nx * (1 - w * 0.5) - nz * side * w; az = nz * (1 - w * 0.5) + nx * side * w; const l = Math.hypot(ax, az) || 1; ax /= l; az /= l; break; }
      case 'ranged': {
        if (d > 9) { /* approach */ } else if (d < 6) { ax = -nx; az = -nz; } else { ax = -nz * ((i & 1) ? 1 : -1) * 0.6; az = nx * ((i & 1) ? 1 : -1) * 0.6; }
        const was = e.aux[i]; e.aux[i] -= dt;
        if (d < 16) {
          if (was > 0.5 && e.aux[i] <= 0.5) s.events.push({ t: 'telegraph', x: e.x[i], z: e.z[i], dx: nx, dz: nz, dur: 0.5 });
          if (e.aux[i] <= 0) { e.aux[i] = c.rng.range(2.2, 3.2); spawnProjectile(s, PK.SPIT, HOSTILE, e.x[i], e.z[i], nx * 9, nz * 9, 3, def.damage * (elite ? ELITE.dmgMult : 1), 0, 0.35); }
        } else if (e.aux[i] < 0.6) e.aux[i] = 0.6;
        break;
      }
      case 'shield': { spd *= d < 3 ? 1.0 : 0.9; break; }
    }
    e.vx[i] += (ax * spd - e.vx[i]) * k; e.vz[i] += (az * spd - e.vz[i]) * k;
    let x = e.x[i] + e.vx[i] * dt, z = e.z[i] + e.vz[i] * dt;
    if (def.ai !== 'phase') {
      // separation via spatial hash
      const n = query(x, z, rad + MAX_ENEMY_RADIUS), out = near.out;
      for (let m = 0; m < n; m++) { const j = out[m]; if (j === i || !e.alive[j]) continue;
        const ox = x - e.x[j], oz = z - e.z[j], min = rad + ENEMIES[e.kind[j]].radius * (e.elite[j] ? ELITE.radiusMult : 1), d2 = ox * ox + oz * oz;
        if (d2 < min * min && d2 > 1e-6) { const dd = Math.sqrt(d2), push = Math.min((min - dd) * 0.5, 0.12); x += ox / dd * push; z += oz / dd * push; } else if (d2 <= 1e-6) { x += 0.05 * ((i & 1) ? 1 : -1); } }
      for (let q = 0; q < obs.length; q++) { const o = obs[q], ox = x - o.x, oz = z - o.z, min = o.r + rad, d2 = ox * ox + oz * oz; if (d2 < min * min) { const dd = Math.sqrt(d2) || 0.001; x = o.x + ox / dd * min; z = o.z + oz / dd * min; } }
    }
    const dd = Math.hypot(x, z), lim = R - 0.5; if (dd > lim) { x *= lim / dd; z *= lim / dd; }
    e.x[i] = x; e.z[i] = z;
    if (e.hitFlash[i] > 0) e.hitFlash[i] -= dt;
    e.facing[i] = Math.atan2(nx, nz);
    if (d < rad + 0.45) hurtPlayer(s, tp, def.damage * (elite ? ELITE.dmgMult : 1));
  }
  rebuild(e, R);
} };
function aliveCountFast(s: { enemies: { count: number; alive: Uint8Array } }) { let n = 0; const e = s.enemies; for (let i = 0; i < e.count; i++) n += e.alive[i]; return n; }
function firstAlive(s: { players: { active: boolean; dead: boolean; x: number; z: number }[] }) { for (const p of s.players) if (p.active && !p.dead) return p; return null; }
