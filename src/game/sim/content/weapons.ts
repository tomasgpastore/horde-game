/** Weapons (GDD): 6 base, levels 1-6, each with an evolution unlocked by owning lvl6 + paired passive. */
export type Behavior = 'bolt' | 'orbit' | 'nova' | 'chain' | 'lava' | 'spear';
export interface WeaponDef {
  id: string; name: string; desc: string; behavior: Behavior;
  cooldown: number; damage: number; speed: number; area: number; pierce: number; duration: number; range: number;
  count: number[];      // by level 1..6
  dmgLv: number;        // +fraction of base dmg per level
  evolvesTo?: string; evolveWith?: string; // passive id
  evolved?: boolean; color: number;
}
const W = (d: WeaponDef) => d;
export const WEAPONS: Record<string, WeaponDef> = {
  ember_bolt: W({ id: 'ember_bolt', name: 'Ember Bolt', desc: 'Homing embers hunt the nearest foe.', behavior: 'bolt', cooldown: 0.7, damage: 9, speed: 15, area: 0.35, pierce: 0, duration: 2.2, range: 16,
    count: [1, 1, 2, 2, 3, 3], dmgLv: 0.22, evolvesTo: 'comet_barrage', evolveWith: 'haste', color: 0xff8a3b }),
  orbit_blades: W({ id: 'orbit_blades', name: 'Orbit Blades', desc: 'Spinning blades circle you.', behavior: 'orbit', cooldown: 0, damage: 7, speed: 3.2, area: 2.6, pierce: 0, duration: 0, range: 0,
    count: [2, 2, 3, 3, 4, 5], dmgLv: 0.2, evolvesTo: 'razor_halo', evolveWith: 'might', color: 0x9fe8ff }),
  frost_nova: W({ id: 'frost_nova', name: 'Frost Nova', desc: 'A freezing ring that slows everything.', behavior: 'nova', cooldown: 3.2, damage: 12, speed: 0, area: 5, pierce: 0, duration: 2.2, range: 0,
    count: [1, 1, 1, 1, 1, 1], dmgLv: 0.25, evolvesTo: 'glacier_pulse', evolveWith: 'area', color: 0x7fd8ff }),
  chain_lightning: W({ id: 'chain_lightning', name: 'Chain Lightning', desc: 'Arcs between nearby enemies.', behavior: 'chain', cooldown: 1.4, damage: 14, speed: 0, area: 6.5, pierce: 0, duration: 0, range: 13,
    count: [3, 4, 4, 5, 6, 7], dmgLv: 0.2, evolvesTo: 'storm_web', evolveWith: 'cooldown', color: 0xc9b6ff }),
  lava_trail: W({ id: 'lava_trail', name: 'Lava Trail', desc: 'Burning pools in your wake.', behavior: 'lava', cooldown: 0.4, damage: 5, speed: 0, area: 1.2, pierce: 0, duration: 3, range: 0,
    count: [1, 1, 1, 1, 1, 1], dmgLv: 0.25, evolvesTo: 'magma_wake', evolveWith: 'speed', color: 0xff5a1f }),
  seeker_spears: W({ id: 'seeker_spears', name: 'Seeker Spears', desc: 'Piercing spears thrown ahead.', behavior: 'spear', cooldown: 1.1, damage: 14, speed: 22, area: 0.55, pierce: 3, duration: 0.85, range: 20,
    count: [1, 2, 2, 3, 3, 4], dmgLv: 0.2, evolvesTo: 'spear_rain', evolveWith: 'pierce', color: 0xffe28a }),
  // Evolutions (fixed stats; level stays 6)
  comet_barrage: W({ id: 'comet_barrage', name: 'Comet Barrage', desc: 'Rapid piercing comets.', behavior: 'bolt', cooldown: 0.32, damage: 16, speed: 18, area: 0.5, pierce: 2, duration: 2.4, range: 18,
    count: [4, 4, 4, 4, 4, 4], dmgLv: 0, evolved: true, color: 0xffb25a }),
  razor_halo: W({ id: 'razor_halo', name: 'Razor Halo', desc: 'A wide ring of whirling steel.', behavior: 'orbit', cooldown: 0, damage: 16, speed: 4.5, area: 3.6, pierce: 0, duration: 0, range: 0,
    count: [8, 8, 8, 8, 8, 8], dmgLv: 0, evolved: true, color: 0xd6f6ff }),
  glacier_pulse: W({ id: 'glacier_pulse', name: 'Glacier Pulse', desc: 'Huge, fast, brutal frost rings.', behavior: 'nova', cooldown: 1.8, damage: 30, speed: 0, area: 8.5, pierce: 0, duration: 3, range: 0,
    count: [1, 1, 1, 1, 1, 1], dmgLv: 0, evolved: true, color: 0xb9ecff }),
  storm_web: W({ id: 'storm_web', name: 'Storm Web', desc: 'Lightning everywhere, constantly.', behavior: 'chain', cooldown: 0.6, damage: 22, speed: 0, area: 8, pierce: 0, duration: 0, range: 16,
    count: [10, 10, 10, 10, 10, 10], dmgLv: 0, evolved: true, color: 0xe2d6ff }),
  magma_wake: W({ id: 'magma_wake', name: 'Magma Wake', desc: 'A river of fire follows you.', behavior: 'lava', cooldown: 0.2, damage: 12, speed: 0, area: 1.9, pierce: 0, duration: 4.5, range: 0,
    count: [1, 1, 1, 1, 1, 1], dmgLv: 0, evolved: true, color: 0xff7a2f }),
  spear_rain: W({ id: 'spear_rain', name: 'Spear Rain', desc: 'A fan of endless piercing spears.', behavior: 'spear', cooldown: 0.6, damage: 24, speed: 26, area: 0.75, pierce: 8, duration: 1.0, range: 22,
    count: [7, 7, 7, 7, 7, 7], dmgLv: 0, evolved: true, color: 0xfff0b0 }),
};
export const BASE_WEAPONS = ['ember_bolt', 'orbit_blades', 'frost_nova', 'chain_lightning', 'lava_trail', 'seeker_spears'];
export const MAX_WEAPONS = 5;
export const MAX_WEAPON_LEVEL = 6;
export interface WeaponStats { damage: number; count: number; cooldown: number; area: number; pierce: number; speed: number; duration: number }
export function weaponStats(def: WeaponDef, level: number, stats: Record<string, number>, out: WeaponStats): WeaponStats {
  const l = Math.min(level, MAX_WEAPON_LEVEL);
  out.damage = def.damage * (1 + def.dmgLv * (l - 1)) * stats.damageMult;
  out.count = def.count[l - 1];
  out.cooldown = def.cooldown * Math.pow(0.95, l - 1) * stats.cooldownMult;
  out.area = def.area * stats.area * (def.behavior === 'bolt' || def.behavior === 'spear' ? 1 : 1 + 0.06 * (l - 1));
  out.pierce = def.pierce + (l >= 4 ? 1 : 0) + (stats.pierce || 0);
  out.speed = def.speed; out.duration = def.duration;
  return out;
}
