import type { SimState } from '@shared/types';
/** Deterministic FNV-1a state hash over everything that affects future sim (not events). Used by determinism test and netcode desync checks. */
const buf = new DataView(new ArrayBuffer(8));
export function hashState(s: SimState, rngState?: number): number {
  let h = 0x811c9dc5;
  const u32 = (v: number) => { h = Math.imul(h ^ (v & 0xff), 16777619); h = Math.imul(h ^ ((v >>> 8) & 0xff), 16777619); h = Math.imul(h ^ ((v >>> 16) & 0xff), 16777619); h = Math.imul(h ^ (v >>> 24), 16777619); };
  const num = (v: number) => { buf.setFloat64(0, v); u32(buf.getUint32(0)); u32(buf.getUint32(4)); };
  const str = (v: string) => { u32(v.length); for (let i = 0; i < v.length; i++) u32(v.charCodeAt(i)); };
  u32(s.tick); num(s.time); u32(s.seed); u32(s.wave); u32(s.kills); num(s.gold); str(s.phase);
  if (rngState !== undefined) u32(rngState);
  u32(s.levelChoices.length); for (const c of s.levelChoices) str(c);
  if (s.boss) { u32(1); const b = s.boss; str(b.id); for (const v of [b.idx, b.maxHp, b.t, b.mode, b.dx, b.dz]) num(v); } else u32(0);
  for (const v of [s.spawner.budget, s.spawner.nextSurge, s.spawner.lastWave, s.spawner.boss ? 1 : 0]) num(v);
  for (const p of s.players) {
    u32(p.id); u32(p.active ? 1 : 0); u32(p.dead ? 1 : 0);
    for (const v of [p.x, p.z, p.vx, p.vz, p.facing, p.hp, p.maxHp, p.level, p.xp, p.xpToNext, p.dashTime, p.dashCooldown, p.iframes]) num(v);
    for (const w of p.weapons) { str(w.id); u32(w.level); num(w.cooldown); }
    for (const k of Object.keys(p.stats).sort()) { str(k); num(p.stats[k]); }
  }
  const pool = (alive: Uint8Array, count: number, arrs: ArrayLike<number>[]) => {
    u32(count);
    for (let i = 0; i < count; i++) { if (!alive[i]) continue; u32(i); for (const a of arrs) num(a[i]); }
  };
  const e = s.enemies, pr = s.projectiles, pk = s.pickups;
  pool(e.alive, e.count, [e.kind, e.x, e.z, e.vx, e.vz, e.hp, e.hitFlash, e.facing]);
  pool(pr.alive, pr.count, [pr.kind, pr.owner, pr.x, pr.z, pr.vx, pr.vz, pr.life, pr.dmg, pr.pierce]);
  pool(pk.alive, pk.count, [pk.kind, pk.x, pk.z, pk.value, pk.magnet]);
  return h >>> 0;
}
