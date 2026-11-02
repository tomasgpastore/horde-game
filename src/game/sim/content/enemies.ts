/** Enemy kind table (index = EnemyPool.kind). Gameplay Engineer owns; GDD roster to be filled in. */
export interface EnemyDef { id: string; speed: number; dmg: number; xp: number; radius: number }
export const ENEMIES: EnemyDef[] = [
  { id: 'husk', speed: 2.3, dmg: 6, xp: 1, radius: 0.45 },
  { id: 'wisp', speed: 3.4, dmg: 4, xp: 1, radius: 0.35 },
  { id: 'brute', speed: 1.7, dmg: 14, xp: 3, radius: 0.7 },
];
export const enemyDef = (kind: number) => ENEMIES[kind] ?? ENEMIES[0];
