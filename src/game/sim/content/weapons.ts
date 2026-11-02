/** Weapon table. ids match GDD. Only ember_bolt implemented in the vertical slice; others TODO (Gameplay). */
export interface WeaponDef { id: string; cooldown: number; dmg: number; speed: number; life: number; pierce: number; range: number }
export const WEAPONS: Record<string, WeaponDef> = {
  ember_bolt: { id: 'ember_bolt', cooldown: 0.55, dmg: 7, speed: 20, life: 1.2, pierce: 0, range: 16 },
  orbit_blades: { id: 'orbit_blades', cooldown: 0, dmg: 5, speed: 0, life: 0, pierce: 0, range: 0 },
  frost_nova: { id: 'frost_nova', cooldown: 3.2, dmg: 9, speed: 0, life: 0, pierce: 0, range: 0 },
  chain_lightning: { id: 'chain_lightning', cooldown: 1.3, dmg: 10, speed: 0, life: 0, pierce: 0, range: 14 },
  lava_trail: { id: 'lava_trail', cooldown: 0.22, dmg: 4, speed: 0, life: 3, pierce: 0, range: 0 },
  seeker_spears: { id: 'seeker_spears', cooldown: 1.1, dmg: 9, speed: 11, life: 2.6, pierce: 1, range: 18 },
};
export const MAX_WEAPON_LEVEL = 8;
/** projectiles per shot, damage and cooldown scaling by level */
export const boltCount = (lvl: number) => 1 + (lvl >= 3 ? 1 : 0) + (lvl >= 6 ? 1 : 0);
export const levelDmg = (lvl: number) => 1 + 0.25 * (lvl - 1);
export const levelCd = (lvl: number) => Math.pow(0.93, lvl - 1);
export const levelPierce = (lvl: number) => (lvl >= 4 ? 1 : 0) + (lvl >= 8 ? 2 : 0);

export const ORBIT = { radius: 2.4, speed: 3.2, dmg: 5, hitCd: 0.35 };
export const orbitCount = (lvl: number) => 2 + Math.floor(lvl / 2);
export const NOVA = { cooldown: 3.2, radius: 5.5, dmg: 9, knock: 2.5 };
export const CHAIN = { cooldown: 1.3, dmg: 10, range: 6, first: 14 };
export const chainJumps = (lvl: number) => 2 + Math.floor(lvl / 2);

export const LAVA = { cooldown: 0.22, dmg: 4, radius: 1.1, hitCd: 0.4 };
export const lavaLife = (lvl: number) => 2.4 + 0.2 * lvl;
export const SPEARS = { cooldown: 1.1, dmg: 9, speed: 11, life: 2.6, range: 18, turn: 5 };
export const spearCount = (lvl: number) => 2 + Math.floor(lvl / 3);
