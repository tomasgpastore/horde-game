/** Weapon table. ids match GDD. Only ember_bolt implemented in the vertical slice; others TODO (Gameplay). */
export interface WeaponDef { id: string; cooldown: number; dmg: number; speed: number; life: number; pierce: number; range: number }
export const WEAPONS: Record<string, WeaponDef> = {
  ember_bolt: { id: 'ember_bolt', cooldown: 0.55, dmg: 7, speed: 20, life: 1.2, pierce: 0, range: 16 },
};
export const MAX_WEAPON_LEVEL = 8;
/** projectiles per shot, damage and cooldown scaling by level */
export const boltCount = (lvl: number) => 1 + (lvl >= 3 ? 1 : 0) + (lvl >= 6 ? 1 : 0);
export const levelDmg = (lvl: number) => 1 + 0.25 * (lvl - 1);
export const levelCd = (lvl: number) => Math.pow(0.93, lvl - 1);
export const levelPierce = (lvl: number) => (lvl >= 4 ? 1 : 0) + (lvl >= 8 ? 2 : 0);
