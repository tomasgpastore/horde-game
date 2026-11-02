import type { System, SimCtx } from '../system';
import type { SimState, PlayerState } from '@shared/types';
import { WEAPONS, weaponStats, type WeaponStats, type WeaponDef, ENEMIES, ELITE, MAX_ENEMY_RADIUS, PK, HOSTILE, PLAYER } from '../content';
import { query, near, rebuild } from './spatial';
import { spawnProjectile, hurtEnemy, hurtPlayer } from './combat';

const ws: WeaponStats = { damage: 0, count: 0, cooldown: 0, area: 0, pierce: 0, speed: 0, duration: 0 };
const chainHit = new Int32Array(16);

function nearestEnemy(s: SimState, x: number, z: number, maxR: number): number {
  const e = s.enemies; let best = -1, bd = maxR * maxR;
  for (let i = 0; i < e.count; i++) { if (!e.alive[i]) continue; const d = (e.x[i] - x) ** 2 + (e.z[i] - z) ** 2; if (d < bd) { bd = d; best = i; } }
  return best;
}
const erad = (s: SimState, i: number) => ENEMIES[s.enemies.kind[i]].radius * (s.enemies.elite[i] ? ELITE.radiusMult : 1);

function fire(s: SimState, c: SimCtx, p: PlayerState, def: WeaponDef, level: number): boolean {
  weaponStats(def, level, p.stats, ws);
  const e = s.enemies;
  switch (def.behavior) {
    case 'bolt': {
      const t = nearestEnemy(s, p.x, p.z, def.range); if (t < 0) return false;
      const base = Math.atan2(e.x[t] - p.x, e.z[t] - p.z);
      for (let k = 0; k < ws.count; k++) { const a = base + (k - (ws.count - 1) / 2) * 0.2;
        spawnProjectile(s, PK.BOLT, p.id, p.x, p.z, Math.sin(a) * ws.speed, Math.cos(a) * ws.speed, ws.duration, ws.damage, ws.pierce, ws.area); }
      s.events.push({ t: 'shoot', weapon: def.id, x: p.x, z: p.z, owner: p.id }); return true;
    }
    case 'spear': {
      if (nearestEnemy(s, p.x, p.z, def.range) < 0) return false;
      const base = Math.atan2(p.stats.mdx || Math.sin(p.facing), p.stats.mdz || Math.cos(p.facing));
      for (let k = 0; k < ws.count; k++) { const a = base + (k - (ws.count - 1) / 2) * 0.16;
        spawnProjectile(s, PK.SPEAR, p.id, p.x, p.z, Math.sin(a) * ws.speed, Math.cos(a) * ws.speed, ws.duration, ws.damage, ws.pierce, ws.area); }
      s.events.push({ t: 'shoot', weapon: def.id, x: p.x, z: p.z, owner: p.id }); return true;
    }
    case 'nova': {
      const n = query(p.x, p.z, ws.area + MAX_ENEMY_RADIUS), out = near.out; let any = false;
      for (let m = 0; m < n; m++) { const i = out[m]; if (!e.alive[i]) continue; const dx = e.x[i] - p.x, dz = e.z[i] - p.z, d = Math.hypot(dx, dz);
        if (d < ws.area + erad(s, i)) { any = true; e.slow[i] = ws.duration; hurtEnemy(s, c, i, ws.damage, dx / (d || 1), dz / (d || 1), 5, p); } }
      if (!any && nearestEnemy(s, p.x, p.z, ws.area * 1.6) < 0) return true; // nothing near: still consume a short cooldown
      s.events.push({ t: 'nova', x: p.x, z: p.z, r: ws.area, style: 'frost' }); s.events.push({ t: 'shoot', weapon: def.id, x: p.x, z: p.z, owner: p.id }); return true;
    }
    case 'chain': {
      let cur = nearestEnemy(s, p.x, p.z, def.range); if (cur < 0) return false;
      let px = p.x, pz = p.z, dmg = ws.damage;
      for (let jump = 0; jump < ws.count && cur >= 0; jump++) {
        chainHit[jump] = cur; const tx = e.x[cur], tz = e.z[cur];
        s.events.push({ t: 'arc', x1: px, z1: pz, x2: tx, z2: tz });
        hurtEnemy(s, c, cur, dmg, 0, 0, 0, p); dmg *= 0.88; px = tx; pz = tz;
        const n = query(px, pz, ws.area), out = near.out; let best = -1, bd = ws.area * ws.area;
        for (let m = 0; m < n; m++) { const j = out[m]; if (!e.alive[j]) continue; let seen = false; for (let q = 0; q <= jump; q++) if (chainHit[q] === j) { seen = true; break; } if (seen) continue;
          const d = (e.x[j] - px) ** 2 + (e.z[j] - pz) ** 2; if (d < bd) { bd = d; best = j; } }
        cur = best;
      }
      s.events.push({ t: 'shoot', weapon: def.id, x: p.x, z: p.z, owner: p.id }); return true;
    }
    case 'lava': {
      if (Math.hypot(p.vx, p.vz) < 1) return false;
      spawnProjectile(s, PK.LAVA, p.id, p.x, p.z, 0, 0, ws.duration, ws.damage, 255, ws.area); return true;
    }
  }
  return false;
}

function syncOrbit(s: SimState, p: PlayerState, def: WeaponDef, level: number) {
  weaponStats(def, level, p.stats, ws);
  const pr = s.projectiles; let have = 0;
  for (let i = 0; i < pr.count; i++) if (pr.alive[i] && pr.kind[i] === PK.ORBIT && pr.owner[i] === p.id) have++;
  if (have !== ws.count) {
    for (let i = 0; i < pr.count; i++) if (pr.alive[i] && pr.kind[i] === PK.ORBIT && pr.owner[i] === p.id) pr.alive[i] = 0;
    for (let k = 0; k < ws.count; k++) { const i = spawnProjectile(s, PK.ORBIT, p.id, p.x, p.z, 0, 0, 1e9, ws.damage, 255, 0.6 * (ws.area / def.area)); if (i >= 0) pr.pierce[i] = k; }
  }
  const ang0 = s.time * ws.speed, R = def.id === 'razor_halo' ? ws.area : ws.area;
  for (let i = 0; i < pr.count; i++) if (pr.alive[i] && pr.kind[i] === PK.ORBIT && pr.owner[i] === p.id) {
    const a = ang0 + pr.pierce[i] * 6.2832 / ws.count; pr.x[i] = p.x + Math.sin(a) * R; pr.z[i] = p.z + Math.cos(a) * R; pr.dmg[i] = ws.damage;
  }
}

export const weaponSystem: System = { name: 'weapons', update(s, c) {
  const dt = c.dt, e = s.enemies, pr = s.projectiles;
  for (const p of s.players) {
    if (!p.active || p.dead) continue;
    for (const w of p.weapons) {
      const def = WEAPONS[w.id];
      if (def.behavior === 'orbit') { syncOrbit(s, p, def, w.level); continue; }
      w.cooldown -= dt;
      if (w.cooldown <= 0) { weaponStats(def, w.level, p.stats, ws); const cd = ws.cooldown; if (fire(s, c, p, def, w.level)) w.cooldown = cd; else w.cooldown = Math.min(0, w.cooldown); }
    }
  }
  // kill orbit blades of dead owners / removed weapons handled by life; dead player's blades:
  for (let i = 0; i < pr.count; i++) {
    if (!pr.alive[i]) continue;
    const kind = pr.kind[i], owner = pr.owner[i];
    if (kind === PK.ORBIT && (s.players[owner].dead)) { pr.alive[i] = 0; continue; }
    if ((pr.life[i] -= dt) <= 0) { pr.alive[i] = 0; continue; }
    if (owner === HOSTILE) {
      pr.x[i] += pr.vx[i] * dt; pr.z[i] += pr.vz[i] * dt;
      for (const p of s.players) { if (!p.active || p.dead) continue; const r = pr.aux[i] + PLAYER.radius;
        if ((p.x - pr.x[i]) ** 2 + (p.z - pr.z[i]) ** 2 < r * r && p.iframes <= 0) { hurtPlayer(s, p, pr.dmg[i]); pr.alive[i] = 0; break; } }
      continue;
    }
    const pl = s.players[owner];
    if (kind === PK.BOLT) { // homing
      const n = query(pr.x[i], pr.z[i], 7), out = near.out; let best = -1, bd = 49;
      for (let m = 0; m < n; m++) { const j = out[m]; if (!e.alive[j]) continue; const d = (e.x[j] - pr.x[i]) ** 2 + (e.z[j] - pr.z[i]) ** 2; if (d < bd) { bd = d; best = j; } }
      if (best >= 0) { const sp = Math.hypot(pr.vx[i], pr.vz[i]), dx = e.x[best] - pr.x[i], dz = e.z[best] - pr.z[i], dl = Math.hypot(dx, dz) || 1, k = Math.min(1, 6 * dt);
        let nx = pr.vx[i] / sp + (dx / dl - pr.vx[i] / sp) * k, nz = pr.vz[i] / sp + (dz / dl - pr.vz[i] / sp) * k; const nl = Math.hypot(nx, nz) || 1; pr.vx[i] = nx / nl * sp; pr.vz[i] = nz / nl * sp; }
    }
    pr.x[i] += pr.vx[i] * dt; pr.z[i] += pr.vz[i] * dt;
    const tick = kind === PK.ORBIT ? (s.tick + pr.pierce[i] * 3) % 15 === 0 : kind === PK.LAVA ? s.tick % 12 === 0 : true;
    if (!tick) continue;
    const n = query(pr.x[i], pr.z[i], pr.aux[i] + MAX_ENEMY_RADIUS), out = near.out;
    const sp = Math.hypot(pr.vx[i], pr.vz[i]) || 1, ux = pr.vx[i] / sp, uz = pr.vz[i] / sp, area = kind === PK.ORBIT || kind === PK.LAVA;
    for (let m = 0; m < n; m++) {
      const j = out[m]; if (!e.alive[j]) continue;
      const r = pr.aux[i] + erad(s, j); if ((e.x[j] - pr.x[i]) ** 2 + (e.z[j] - pr.z[i]) ** 2 > r * r) continue;
      if (!area) { let seen = false; for (let q = 0; q < 4; q++) if (pr.hits[i * 4 + q] === j) { seen = true; break; } if (seen) continue; pr.hits[i * 4 + (pr.hitN[i]++ & 3)] = j; }
      hurtEnemy(s, c, j, pr.dmg[i], area ? 0 : ux, area ? 0 : uz, area ? 0 : 3, pl);
      if (!area) { if (pr.pierce[i] === 0) { pr.alive[i] = 0; break; } pr.pierce[i]--; }
    }
  }
  rebuild(e, c.arena.radius);
} };
