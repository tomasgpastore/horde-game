import type { PlayerState } from '@shared/types';
import type { Rng } from '@shared/rng';
import { MAX_WEAPON_LEVEL } from './weapons';
export interface UpgradeDef { id: string; name: string; desc: string }
export const UPGRADES: UpgradeDef[] = [
  { id: 'w:ember_bolt', name: 'Ember Bolt', desc: 'Level up: more damage, faster, extra bolts' },
  { id: 'w:orbit_blades', name: 'Orbit Blades', desc: 'Spectral blades circle you' },
  { id: 'w:frost_nova', name: 'Frost Nova', desc: 'Periodic burst that damages and shoves' },
  { id: 'w:chain_lightning', name: 'Chain Lightning', desc: 'Arcs between nearby enemies' },
  { id: 'p:might', name: 'Might', desc: '+15% damage' },
  { id: 'p:haste', name: 'Haste', desc: '-10% weapon cooldown' },
  { id: 'p:speed', name: 'Swiftness', desc: '+10% move speed' },
  { id: 'p:magnet', name: 'Magnet', desc: '+35% pickup radius' },
  { id: 'p:armor', name: 'Armor', desc: '-2 damage taken from every hit' },
  { id: 'p:area', name: 'Reach', desc: '+15% area: blades, nova' },
  { id: 'p:luck', name: 'Fortune', desc: '+5% crit chance' },
  { id: 'p:hp', name: 'Vitality', desc: '+25 max HP and heal 25' },
];
export const upgradeDef = (id: string) => UPGRADES.find(u => u.id === id)!;
function available(p: PlayerState): UpgradeDef[] {
  return UPGRADES.filter(u => !u.id.startsWith('w:') || (p.weapons.find(w => 'w:' + w.id === u.id)?.level ?? 0) < MAX_WEAPON_LEVEL);
}
/** Pick `n` distinct choices deterministically. */
export function rollChoices(p: PlayerState, rng: Rng, n = 3): string[] {
  const pool = available(p).map(u => u.id), out: string[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(rng.int(pool.length), 1)[0]);
  return out;
}
export function applyUpgrade(p: PlayerState, id: string) {
  if (id.startsWith('w:')) { const w = p.weapons.find(w => 'w:' + w.id === id); if (w) w.level++; else p.weapons.push({ id: id.slice(2), level: 1, cooldown: 0 }); return; }
  const st = p.stats;
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
