import { WEAPONS, BASE_WEAPONS, MAX_WEAPONS, MAX_WEAPON_LEVEL } from './weapons';
import type { PlayerState } from '@shared/types';
/** Passives + level-up choice generation. Choice ids: 'w:<weapon>' (new/level), 'e:<evolved>', 'p:<passive>', 'x:heal'. */
export interface PassiveDef { id: string; name: string; desc: string; max: number; color: number }
export const PASSIVES: Record<string, PassiveDef> = {
  might:    { id: 'might',    name: 'Might',    desc: '+15% damage',            max: 5, color: 0xff6a2b },
  haste:    { id: 'haste',    name: 'Haste',    desc: '-8% weapon cooldowns',   max: 5, color: 0xffd35a },
  area:     { id: 'area',     name: 'Area',     desc: '+10% area & size',       max: 5, color: 0x7fd8ff },
  speed:    { id: 'speed',    name: 'Swiftness',desc: '+7% move speed',         max: 5, color: 0x3df2ff },
  magnet:   { id: 'magnet',   name: 'Magnet',   desc: '+30% pickup range',      max: 5, color: 0x19c9a5 },
  maxhp:    { id: 'maxhp',    name: 'Vitality', desc: '+20 max HP, heal 20',    max: 5, color: 0xff3355 },
  armor:    { id: 'armor',    name: 'Armor',    desc: '-1 damage from hits',    max: 5, color: 0xbfc7d9 },
  luck:     { id: 'luck',     name: 'Luck',     desc: '+5% crit chance',        max: 5, color: 0xb6ff3b },
  cooldown: { id: 'cooldown', name: 'Focus',    desc: '-6% weapon cooldowns',   max: 5, color: 0xc9b6ff },
  pierce:   { id: 'pierce',   name: 'Piercing', desc: '+1 projectile pierce',   max: 3, color: 0xffe28a },
};
const lv = (p: PlayerState, id: string) => p.stats['lv_' + id] || 0;
export const passiveLevel = lv;
/** Recompute derived stats from passive levels. Call after any passive change. */
export function recomputeStats(p: PlayerState) {
  const s = p.stats;
  s.moveSpeed = 6 * (1 + 0.07 * lv(p, 'speed'));
  s.damageMult = 1 + 0.15 * lv(p, 'might');
  s.cooldownMult = Math.pow(0.92, lv(p, 'haste')) * Math.pow(0.94, lv(p, 'cooldown'));
  s.area = 1 + 0.1 * lv(p, 'area');
  s.pickupRadius = 2.5 * (1 + 0.3 * lv(p, 'magnet'));
  s.armor = lv(p, 'armor');
  s.crit = 0.05 + 0.05 * lv(p, 'luck');
  s.pierce = lv(p, 'pierce');
  p.maxHp = 100 + 20 * lv(p, 'maxhp');
}
export interface Rolls { int(n: number): number }
export function rollChoices(p: PlayerState, rng: Rolls, n = 3): string[] {
  const pool: string[] = [];
  const owned = new Map(p.weapons.map(w => [w.id, w]));
  for (const w of p.weapons) {
    const d = WEAPONS[w.id];
    if (d.evolvesTo && w.level >= MAX_WEAPON_LEVEL && lv(p, d.evolveWith!) >= 1) { pool.push('e:' + d.evolvesTo, 'e:' + d.evolvesTo, 'e:' + d.evolvesTo); }
    else if (!d.evolved && w.level < MAX_WEAPON_LEVEL) pool.push('w:' + w.id, 'w:' + w.id);
  }
  if (p.weapons.length < MAX_WEAPONS) for (const id of BASE_WEAPONS) if (!owned.has(id)) pool.push('w:' + id);
  const ownedPassives = Object.keys(PASSIVES).filter(id => lv(p, id) > 0 && lv(p, id) < PASSIVES[id].max);
  for (const id of Object.keys(PASSIVES)) if (lv(p, id) < PASSIVES[id].max) pool.push('p:' + id);
  // owned passives that gate evolutions get weighted up
  for (const w of p.weapons) { const d = WEAPONS[w.id]; if (d.evolveWith && lv(p, d.evolveWith) < PASSIVES[d.evolveWith].max) pool.push('p:' + d.evolveWith); }
  for (const id of ownedPassives) pool.push('p:' + id);
  const out: string[] = [];
  let guard = 200;
  while (out.length < n && pool.length && guard-- > 0) { const c = pool[rng.int(pool.length)]; if (!out.includes(c)) out.push(c); }
  while (out.length < n) out.push('x:heal');
  return out;
}
export function applyChoice(p: PlayerState, id: string) {
  const [k, v] = [id.slice(0, 1), id.slice(2)];
  if (k === 'w') { const w = p.weapons.find(x => x.id === v); if (w) w.level = Math.min(MAX_WEAPON_LEVEL, w.level + 1); else p.weapons.push({ id: v, level: 1, cooldown: 0 }); }
  else if (k === 'e') { const i = p.weapons.findIndex(x => WEAPONS[x.id].evolvesTo === v); if (i >= 0) p.weapons[i] = { id: v, level: MAX_WEAPON_LEVEL, cooldown: 0 }; }
  else if (k === 'p') { p.stats['lv_' + v] = lv(p, v) + 1; recomputeStats(p); if (v === 'maxhp') p.hp = Math.min(p.maxHp, p.hp + 20); }
  else if (k === 'x') { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.4); }
}
export interface ChoiceInfo { id: string; kind: 'weapon' | 'evolve' | 'passive' | 'heal'; name: string; desc: string; tier: number; maxTier: number; color: number }
export function describeChoice(p: PlayerState, id: string): ChoiceInfo {
  const k = id.slice(0, 1), v = id.slice(2);
  if (k === 'w') { const d = WEAPONS[v], w = p.weapons.find(x => x.id === v); return { id, kind: 'weapon', name: d.name, desc: w ? `Level ${w.level + 1}: stronger & faster` : d.desc, tier: w ? w.level + 1 : 1, maxTier: MAX_WEAPON_LEVEL, color: d.color }; }
  if (k === 'e') { const d = WEAPONS[v]; return { id, kind: 'evolve', name: d.name, desc: 'EVOLUTION — ' + d.desc, tier: 7, maxTier: 7, color: d.color }; }
  if (k === 'p') { const d = PASSIVES[v]; return { id, kind: 'passive', name: d.name, desc: d.desc, tier: lv(p, v) + 1, maxTier: d.max, color: d.color }; }
  return { id, kind: 'heal', name: 'Second Wind', desc: 'Restore 40% HP', tier: 1, maxTier: 1, color: 0x3df2ff };
}
/** XP needed to go from `level` to level+1. */
export const xpToNext = (level: number) => Math.floor(5 + 5 * (level - 1) + 0.9 * (level - 1) * (level - 1));
