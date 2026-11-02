import type { PlayerState } from '@shared/types';
import type { Rng } from '@shared/rng';
import { MAX_WEAPON_LEVEL } from './weapons';
export interface UpgradeDef { id: string; name: string; desc: string }
export const UPGRADES: UpgradeDef[] = [
  { id: 'w:ember_bolt', name: 'Ember Bolt', desc: 'Level up: more damage, faster, extra bolts' },
  { id: 'w:orbit_blades', name: 'Orbit Blades', desc: 'Spectral blades circle you' },
  { id: 'w:frost_nova', name: 'Frost Nova', desc: 'Periodic burst that damages and shoves' },
  { id: 'w:chain_lightning', name: 'Chain Lightning', desc: 'Arcs between nearby enemies' },
  { id: 'w:lava_trail', name: 'Lava Trail', desc: 'Leave burning ground behind you' },
  { id: 'w:seeker_spears', name: 'Seeker Spears', desc: 'Homing spears hunt the nearest enemy' },
  { id: 'p:might', name: 'Might', desc: '+15% damage' },
  { id: 'p:haste', name: 'Haste', desc: '-10% weapon cooldown' },
  { id: 'p:speed', name: 'Swiftness', desc: '+10% move speed' },
  { id: 'p:magnet', name: 'Magnet', desc: '+35% pickup radius' },
  { id: 'p:armor', name: 'Armor', desc: '-2 damage taken from every hit' },
  { id: 'p:area', name: 'Reach', desc: '+15% area: blades, nova' },
  { id: 'p:luck', name: 'Fortune', desc: '+5% crit chance' },
  { id: 'p:hp', name: 'Vitality', desc: '+25 max HP and heal 25' },
];
/** Evolutions: weapon at MAX level + its paired passive owned => 'e:<weapon>' card. Effect: +4 virtual levels (more bolts/blades, damage, speed) and evolved flag. */
export const EVOLUTIONS: Record<string, { name: string; passive: string; has: (p: PlayerState) => boolean }> = {
  ember_bolt: { name: 'Solar Lance', passive: 'Might', has: p => p.stats.damageMult > 1.001 },
  orbit_blades: { name: 'Thousand Blades', passive: 'Reach', has: p => p.stats.area > 1.001 },
  frost_nova: { name: 'Absolute Zero', passive: 'Haste', has: p => p.stats.cooldownMult < 0.999 },
  chain_lightning: { name: 'Storm Crown', passive: 'Fortune', has: p => (p.stats.luck ?? 0) > 0 },
  lava_trail: { name: 'Magma Wake', passive: 'Armor', has: p => (p.stats.armor ?? 0) > 0 },
  seeker_spears: { name: 'Hunter Choir', passive: 'Swiftness', has: p => p.stats.moveSpeed > 6.01 },
};
export const EVOLVE_LEVELS = 4;
export const upgradeDef = (id: string): UpgradeDef => {
  if (id.startsWith('e:')) { const w = id.slice(2), e = EVOLUTIONS[w]; return { id, name: `EVOLVE: ${e.name}`, desc: `${UPGRADES.find(u => u.id === 'w:' + w)!.name} supercharged (+${EVOLVE_LEVELS} levels)` }; }
  return UPGRADES.find(u => u.id === id)!;
};
function evolutions(p: PlayerState, boss = false): string[] {
  // boss chest: any weapon at level >= 4 may evolve (no passive needed); normal: max level + paired passive
  return p.weapons.filter(w => !w.evolved && EVOLUTIONS[w.id] && (boss ? w.level >= 4 : w.level >= MAX_WEAPON_LEVEL && EVOLUTIONS[w.id].has(p))).sort((a, b) => b.level - a.level).map(w => 'e:' + w.id);
}
export const MAX_PASSIVE_STACKS = 8;
function available(p: PlayerState): UpgradeDef[] {
  return UPGRADES.filter(u => u.id.startsWith('w:') ? (p.weapons.find(w => 'w:' + w.id === u.id)?.level ?? 0) < MAX_WEAPON_LEVEL : (p.stats['n_' + u.id] ?? 0) < MAX_PASSIVE_STACKS); // passives cap at 8 stacks (no infinite snowball)
}
/** Pick `n` distinct choices deterministically. */
export function rollChoices(p: PlayerState, rng: Rng, n = 3, boss = false): string[] {
  const out: string[] = evolutions(p, boss).slice(0, 1); // an available evolution always leads the offer
  const pool = available(p).map(u => u.id);
  while (out.length < n && pool.length) out.push(pool.splice(rng.int(pool.length), 1)[0]);
  return out;
}
export function applyUpgrade(p: PlayerState, id: string) {
  if (id.startsWith('e:')) { const w = p.weapons.find(w => 'e:' + w.id === id); if (w) { w.evolved = true; w.level += EVOLVE_LEVELS; } return; }
  if (id.startsWith('w:')) { const w = p.weapons.find(w => 'w:' + w.id === id); if (w) w.level++; else p.weapons.push({ id: id.slice(2), level: 1, cooldown: 0 }); return; }
  const st = p.stats; st['n_' + id] = (st['n_' + id] ?? 0) + 1;
  switch (id) {
    case 'p:might': st.damageMult *= 1.15; break;
    case 'p:haste': st.cooldownMult *= 0.9; break;
    case 'p:speed': st.moveSpeed *= 1.1; break;
    case 'p:magnet': st.pickupRadius *= 1.35; break;
    case 'p:armor': st.armor = (st.armor ?? 0) + 2; break;
    case 'p:area': st.area *= 1.15; break;
    case 'p:luck': st.luck = (st.luck ?? 0) + 0.05; break;
    case 'p:hp': p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); break;
  }
}
