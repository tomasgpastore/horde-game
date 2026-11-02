import type { System, SimCtx } from '../system';
import { alloc } from '../pools';
import { MAX_PROJECTILES, MAX_ENEMIES } from '@shared/types';
import type { SimState, PlayerState } from '@shared/types';
import { WEAPONS, boltCount, levelDmg, levelCd, levelPierce, ORBIT, orbitCount, NOVA, CHAIN, chainJumps, LAVA, lavaLife, SPEARS, spearCount } from '../content/weapons';
import { resetHit, killEnemy } from './projectiles';

/** Projectile kinds: 0 bolt, 1 orbit blade (positioned by weapon system), 2 nova ring (expanding, vx=max radius), 3 chain spark (brief), 4 lava patch (stationary, life ~3s, ticks damage), 5 seeker spear (bolt-like, homing). */
function spawnProj(s: SimState, kind: number, owner: number, x: number, z: number, vx: number, vz: number, life: number, dmg: number, pierce: number) {
  const pr = s.projectiles, i = alloc(pr.alive, pr.count, MAX_PROJECTILES); if (i < 0) return -1;
  pr.alive[i] = 1; pr.kind[i] = kind; pr.owner[i] = owner; pr.x[i] = x; pr.z[i] = z; pr.vx[i] = vx; pr.vz[i] = vz; pr.life[i] = life; pr.dmg[i] = dmg; pr.pierce[i] = pierce;
  resetHit(i); if (i >= pr.count) pr.count = i + 1; return i;
}
function damage(s: SimState, ctx: SimCtx, j: number, dmg: number) {
  const e = s.enemies; e.hp[j] -= dmg; e.hitFlash[j] = 0.1;
  s.events.push({ t: 'hit', x: e.x[j], z: e.z[j], dmg, crit: false, enemyKind: e.kind[j] });
  if (e.hp[j] <= 0) killEnemy(s, j);
}
function nearest(s: SimState, x: number, z: number, maxD: number, skip: Uint8Array | null): number {
  const e = s.enemies; let best = maxD * maxD, bi = -1;
  for (let i = 0; i < e.count; i++) { if (!e.alive[i] || (skip && skip[i])) continue;
    const dx = e.x[i] - x, dz = e.z[i] - z, d = dx * dx + dz * dz; if (d < best) { best = d; bi = i; } }
  return bi;
}
const orbitCdT = new Float32Array(MAX_ENEMIES), lavaCdT = new Float32Array(MAX_ENEMIES), chainSeen = new Uint8Array(MAX_ENEMIES);

function bolt(s: SimState, c: SimCtx, p: PlayerState, w: PlayerState['weapons'][0]) {
  const def = WEAPONS.ember_bolt, t = nearest(s, p.x, p.z, def.range, null); if (t < 0) { w.cooldown = 0.05; return; }
  w.cooldown = def.cooldown * levelCd(w.level) * p.stats.cooldownMult;
  const e = s.enemies, base = Math.atan2(e.z[t] - p.z, e.x[t] - p.x), n = boltCount(w.level);
  for (let k = 0; k < n; k++) { const a = base + (k - (n - 1) / 2) * 0.16;
    spawnProj(s, 0, p.id, p.x, p.z, Math.cos(a) * def.speed, Math.sin(a) * def.speed, def.life, def.dmg * levelDmg(w.level) * p.stats.damageMult, def.pierce + levelPierce(w.level)); }
  s.events.push({ t: 'shoot', weapon: w.id, x: p.x, z: p.z, owner: p.id });
}
function orbit(s: SimState, c: SimCtx, p: PlayerState, w: PlayerState['weapons'][0]) {
  const pr = s.projectiles, e = s.enemies;
  for (let i = 0; i < pr.count; i++) if (pr.alive[i] && pr.kind[i] === 1 && pr.owner[i] === p.id) pr.alive[i] = 0;
  const n = orbitCount(w.level), R = ORBIT.radius * p.stats.area, ang0 = s.time * ORBIT.speed, dmg = ORBIT.dmg * levelDmg(w.level) * p.stats.damageMult;
  for (let k = 0; k < n; k++) { const a = ang0 + k / n * Math.PI * 2, bx = p.x + Math.cos(a) * R, bz = p.z + Math.sin(a) * R;
    spawnProj(s, 1, p.id, bx, bz, 0, 0, 1, dmg, 99);
    for (let j = 0; j < e.count; j++) { if (!e.alive[j] || orbitCdT[j] > s.time) continue;
      const dx = e.x[j] - bx, dz = e.z[j] - bz; if (dx * dx + dz * dz < 0.9 * 0.9) { orbitCdT[j] = s.time + ORBIT.hitCd; damage(s, c, j, dmg); } } }
}
function nova(s: SimState, c: SimCtx, p: PlayerState, w: PlayerState['weapons'][0]) {
  const R = NOVA.radius * p.stats.area * (1 + 0.06 * (w.level - 1)), e = s.enemies;
  let any = false; for (let j = 0; j < e.count && !any; j++) if (e.alive[j]) { const dx = e.x[j] - p.x, dz = e.z[j] - p.z; if (dx * dx + dz * dz < R * R * 1.5) any = true; }
  if (!any) { w.cooldown = 0.1; return; }
  w.cooldown = NOVA.cooldown * levelCd(w.level) * p.stats.cooldownMult;
  const dmg = NOVA.dmg * levelDmg(w.level) * p.stats.damageMult;
  for (let j = 0; j < e.count; j++) { if (!e.alive[j]) continue; const dx = e.x[j] - p.x, dz = e.z[j] - p.z, d2 = dx * dx + dz * dz;
    if (d2 < R * R) { const d = Math.sqrt(d2) || 1; e.x[j] += dx / d * NOVA.knock; e.z[j] += dz / d * NOVA.knock; damage(s, c, j, dmg); } }
  spawnProj(s, 2, p.id, p.x, p.z, R, 0, 0.35, 0, 0);
  s.events.push({ t: 'shoot', weapon: w.id, x: p.x, z: p.z, owner: p.id });
}
function chain(s: SimState, c: SimCtx, p: PlayerState, w: PlayerState['weapons'][0]) {
  let j = nearest(s, p.x, p.z, WEAPONS.chain_lightning.range, null); if (j < 0) { w.cooldown = 0.05; return; }
  w.cooldown = CHAIN.cooldown * levelCd(w.level) * p.stats.cooldownMult;
  const e = s.enemies, dmg = CHAIN.dmg * levelDmg(w.level) * p.stats.damageMult; chainSeen.fill(0, 0, e.count);
  for (let k = 0, jumps = chainJumps(w.level); k <= jumps && j >= 0; k++) {
    chainSeen[j] = 1; const x = e.x[j], z = e.z[j]; spawnProj(s, 3, p.id, x, z, 0, 0, 0.14, 0, 0); damage(s, c, j, dmg);
    j = nearest(s, x, z, CHAIN.range, chainSeen);
  }
  s.events.push({ t: 'shoot', weapon: w.id, x: p.x, z: p.z, owner: p.id });
}
function lava(s: SimState, c: SimCtx, p: PlayerState, w: PlayerState['weapons'][0]) {
  w.cooldown = LAVA.cooldown * p.stats.cooldownMult;
  spawnProj(s, 4, p.id, p.x, p.z, LAVA.radius * p.stats.area, 0, lavaLife(w.level), LAVA.dmg * levelDmg(w.level) * p.stats.damageMult, 0);
}
function spears(s: SimState, c: SimCtx, p: PlayerState, w: PlayerState['weapons'][0]) {
  const t = nearest(s, p.x, p.z, SPEARS.range, null); if (t < 0) { w.cooldown = 0.05; return; }
  w.cooldown = SPEARS.cooldown * levelCd(w.level) * p.stats.cooldownMult;
  const n = spearCount(w.level), base = Math.atan2(s.enemies.z[t] - p.z, s.enemies.x[t] - p.x), dmg = SPEARS.dmg * levelDmg(w.level) * p.stats.damageMult;
  for (let k = 0; k < n; k++) { const a = base + (k - (n - 1) / 2) * 0.7;
    spawnProj(s, 5, p.id, p.x, p.z, Math.cos(a) * SPEARS.speed, Math.sin(a) * SPEARS.speed, SPEARS.life, dmg, 1); }
  s.events.push({ t: 'shoot', weapon: w.id, x: p.x, z: p.z, owner: p.id });
}
/** Per-tick passes for persistent projectiles: lava patches damage enemies standing in them; spears steer toward the nearest enemy. */
function persistent(s: SimState, c: SimCtx) {
  const pr = s.projectiles, e = s.enemies;
  for (let i = 0; i < pr.count; i++) { if (!pr.alive[i]) continue; const k = pr.kind[i];
    if (k === 4) { const R2 = pr.vx[i] * pr.vx[i];
      for (let j = 0; j < e.count; j++) { if (!e.alive[j] || lavaCdT[j] > s.time) continue;
        const dx = e.x[j] - pr.x[i], dz = e.z[j] - pr.z[i]; if (dx * dx + dz * dz < R2) { lavaCdT[j] = s.time + LAVA.hitCd; damage(s, c, j, pr.dmg[i]); } } }
    else if (k === 5) { const t = nearest(s, pr.x[i], pr.z[i], SPEARS.range, null); if (t < 0) continue;
      const sp = Math.hypot(pr.vx[i], pr.vz[i]) || SPEARS.speed, cur = Math.atan2(pr.vz[i], pr.vx[i]), want = Math.atan2(e.z[t] - pr.z[i], e.x[t] - pr.x[i]);
      let d = want - cur; d = Math.atan2(Math.sin(d), Math.cos(d)); const step = Math.max(-SPEARS.turn * c.dt, Math.min(SPEARS.turn * c.dt, d)), a = cur + step;
      pr.vx[i] = Math.cos(a) * sp; pr.vz[i] = Math.sin(a) * sp; } }
}
const HANDLERS: Record<string, typeof bolt> = { ember_bolt: bolt, orbit_blades: orbit, frost_nova: nova, chain_lightning: chain, lava_trail: lava, seeker_spears: spears };

export const weaponSystem: System = { name: 'weapons', update(s, c) {
  if (s.tick === 0) { orbitCdT.fill(0); lavaCdT.fill(0); } // module arrays must not leak between runs
  for (const p of s.players) { if (!p.active || p.dead) continue;
    for (const w of p.weapons) { const h = HANDLERS[w.id]; if (!h) continue;
      if (w.id === 'orbit_blades') { h(s, c, p, w); continue; }
      w.cooldown -= c.dt; if (w.cooldown <= 0) h(s, c, p, w); } }
  persistent(s, c);
} };
