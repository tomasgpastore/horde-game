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
];
export const enemyDef = (kind: number) => ENEMIES[kind] ?? ENEMIES[0];
