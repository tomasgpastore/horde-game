/** Enemy kind table (index = EnemyPool.kind). Gameplay Engineer owns; GDD roster to be filled in. */
export interface EnemyDef { id: string; hp: number; speed: number; dmg: number; xp: number; radius: number }
export const ENEMIES: EnemyDef[] = [
  { id: 'husk', hp: 6, speed: 2.3, dmg: 6, xp: 1, radius: 0.45 },
  { id: 'wisp', hp: 14, speed: 3.4, dmg: 4, xp: 1, radius: 0.35 },
  { id: 'brute', hp: 40, speed: 1.7, dmg: 14, xp: 3, radius: 0.7 },
  { id: 'skitter', hp: 4, speed: 5.2, dmg: 3, xp: 1, radius: 0.3 },
  { id: 'bloater', hp: 70, speed: 1.2, dmg: 18, xp: 5, radius: 0.95 },
  { id: 'shield_knight', hp: 55, speed: 1.9, dmg: 12, xp: 4, radius: 0.6 },
  { id: 'spitter', hp: 16, speed: 2.0, dmg: 6, xp: 2, radius: 0.45 },   // TODO ranged attack (Gameplay)
  { id: 'wraith', hp: 26, speed: 3.0, dmg: 9, xp: 3, radius: 0.5 },    // TODO phases through obstacles
  { id: 'boss', hp: 1, speed: 0, dmg: 25, xp: 40, radius: 1.5 }, // kind 8: stats driven by BOSSES table; movement by systems/boss.ts
];
export const BOSS_KIND = 8;
/** hp/speed/charge per boss id (GDD: Hollow Stag min5, Bell-Warden min10, The Unlit min15). */
export const BOSSES: Record<string, { name: string; hp: number; speed: number; charge: number; windup: number; cd: number }> = {
  hollow_stag: { name: 'The Hollow Stag', hp: 900, speed: 2.6, charge: 17, windup: 0.9, cd: 3.2 },
  bell_warden: { name: 'The Bell-Warden', hp: 2400, speed: 2.9, charge: 19, windup: 0.8, cd: 2.8 },
  the_unlit: { name: 'The Unlit', hp: 6000, speed: 3.3, charge: 22, windup: 0.7, cd: 2.4 },
};
export const enemyDef = (kind: number) => ENEMIES[kind] ?? ENEMIES[0];
