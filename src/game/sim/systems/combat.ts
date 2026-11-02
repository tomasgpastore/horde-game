import type { SimState, PlayerState } from '@shared/types';
import { MAX_ENEMIES, MAX_PICKUPS, MAX_PROJECTILES } from '@shared/types';
import type { SimCtx } from '../system';
import { alloc } from '../pools';
import { ENEMIES, ELITE, PU, PK, HOSTILE, PLAYER } from '../content';

export function spawnProjectile(s: SimState, kind: number, owner: number, x: number, z: number, vx: number, vz: number, life: number, dmg: number, pierce: number, radius: number): number {
  const p = s.projectiles, i = alloc(p.alive, p.count, MAX_PROJECTILES); if (i < 0) return -1;
  p.alive[i] = 1; p.kind[i] = kind; p.owner[i] = owner; p.x[i] = x; p.z[i] = z; p.vx[i] = vx; p.vz[i] = vz;
  p.life[i] = life; p.dmg[i] = dmg; p.pierce[i] = pierce > 255 ? 255 : pierce; p.aux[i] = radius; p.hitN[i] = 0; p.hits.fill(-1, i * 4, i * 4 + 4);
  if (i >= p.count) p.count = i + 1; return i;
}
export function spawnPickup(s: SimState, kind: number, x: number, z: number, value: number): number {
  const p = s.pickups, i = alloc(p.alive, p.count, MAX_PICKUPS); if (i < 0) return -1;
  p.alive[i] = 1; p.kind[i] = kind; p.x[i] = x; p.z[i] = z; p.value[i] = value; p.magnet[i] = 0; if (i >= p.count) p.count = i + 1; return i;
}
export function spawnEnemy(s: SimState, kind: number, x: number, z: number, hpMult: number, elite: boolean, aux: number): number {
  const e = s.enemies, i = alloc(e.alive, e.count, MAX_ENEMIES); if (i < 0) return -1;
  e.alive[i] = 1; e.kind[i] = kind; e.x[i] = x; e.z[i] = z; e.vx[i] = 0; e.vz[i] = 0; e.hp[i] = ENEMIES[kind].hp * hpMult * (elite ? ELITE.hpMult : 1);
  e.hitFlash[i] = 0; e.slow[i] = 0; e.aux[i] = aux; e.elite[i] = elite ? 1 : 0; e.facing[i] = 0; if (i >= e.count) e.count = i + 1; return i;
}
export const enemyRadius = (s: SimState, i: number) => ENEMIES[s.enemies.kind[i]].radius * (s.enemies.elite[i] ? ELITE.radiusMult : 1);

/** Deal damage to enemy i. (dx,dz) = unit travel dir of the attack (0,0 for area effects, which ignore shields). player = attacker index for crit stats. */
export function hurtEnemy(s: SimState, c: SimCtx, i: number, dmg: number, dx: number, dz: number, knock: number, player: PlayerState | null) {
  const e = s.enemies, def = ENEMIES[e.kind[i]];
  let crit = false;
  if (player && c.rng.next() < player.stats.crit) { crit = true; dmg *= 2; }
  if (def.ai === 'shield' && (dx !== 0 || dz !== 0)) { // frontal shield: attack travelling against the knight's facing is blocked
    const f = e.facing[i]; if (-(dx * Math.sin(f) + dz * Math.cos(f)) > 0.35) { dmg *= 0.12; crit = false; }
  }
  e.hp[i] -= dmg; e.hitFlash[i] = 0.1;
  if (knock > 0) { const k = knock * (1 - def.kbResist); e.vx[i] += dx * k; e.vz[i] += dz * k; }
  s.events.push({ t: 'hit', x: e.x[i], z: e.z[i], dmg, crit, enemyKind: e.kind[i] });
  if (e.hp[i] <= 0) killEnemy(s, c, i);
}
export function killEnemy(s: SimState, c: SimCtx, i: number) {
  const e = s.enemies, def = ENEMIES[e.kind[i]], x = e.x[i], z = e.z[i], elite = e.elite[i] === 1;
  e.alive[i] = 0; s.kills++;
  s.events.push({ t: 'kill', x, z, enemyKind: e.kind[i], elite });
  const xpv = def.xp * (elite ? ELITE.xpMult : 1);
  if (spawnPickup(s, PU.XP, x + c.rng.range(-0.3, 0.3), z + c.rng.range(-0.3, 0.3), xpv) < 0) { // pool full: pay out directly
    for (const p of s.players) if (p.active && !p.dead) p.xp += xpv / 1; }
  const r = c.rng.next();
  if (r < 0.06) spawnPickup(s, PU.GOLD, x, z, 1 + c.rng.int(3));
  else if (r < 0.075) spawnPickup(s, PU.HEALTH, x, z, 15);
  if (elite) { spawnPickup(s, PU.CHEST, x, z, 1); s.events.push({ t: 'chest', x, z }); }
  if (def.id === 'bloater') { // toxic burst
    s.events.push({ t: 'nova', x, z, r: 3, style: 'toxic' });
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + c.rng.range(0, 0.4); spawnProjectile(s, PK.TOXIC, HOSTILE, x, z, Math.sin(a) * 4.5, Math.cos(a) * 4.5, 1.1, 7, 0, 0.45); }
  }
}
export function hurtPlayer(s: SimState, p: PlayerState, dmg: number) {
  if (p.dead || p.iframes > 0) return;
  const d = Math.max(1, dmg - (p.stats.armor || 0));
  p.hp -= d; p.iframes = PLAYER.hitIframes; s.events.push({ t: 'playerHurt', id: p.id, dmg: d });
  if (p.hp <= 0) { p.hp = 0; p.dead = true; p.vx = p.vz = 0; }
}
