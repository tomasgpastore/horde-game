/** Enemy kinds. Index in ENEMIES == EnemyPool.kind (render keys colors/meshes off this order). Numbers per GDD; tune here only. */
export type EnemyAI = 'chase' | 'erratic' | 'ranged' | 'circle' | 'phase' | 'shield';
export interface EnemyDef {
  id: string; name: string; hp: number; speed: number; radius: number; damage: number; xp: number;
  ai: EnemyAI; kbResist: number; // 0..1 knockback resisted
  color: number;                 // hint for render
}
export const ENEMIES: EnemyDef[] = [
  { id: 'husk',    name: 'Husk',          hp: 12,  speed: 2.4, radius: 0.55, damage: 6,  xp: 1,  ai: 'chase',   kbResist: 0,    color: 0xff6a2b },
  { id: 'wisp',    name: 'Wisp',          hp: 6,   speed: 4.6, radius: 0.4,  damage: 4,  xp: 1,  ai: 'erratic', kbResist: 0,    color: 0xff2e88 },
  { id: 'brute',   name: 'Brute',         hp: 70,  speed: 1.6, radius: 0.95, damage: 14, xp: 6,  ai: 'chase',   kbResist: 0.85, color: 0xff6a2b },
  { id: 'spitter', name: 'Spitter',       hp: 18,  speed: 2.2, radius: 0.55, damage: 8,  xp: 3,  ai: 'ranged',  kbResist: 0.2,  color: 0xb6ff3b },
  { id: 'bloater', name: 'Bloater',       hp: 40,  speed: 1.5, radius: 0.9,  damage: 8,  xp: 4,  ai: 'chase',   kbResist: 0.5,  color: 0xb6ff3b },
  { id: 'skitter', name: 'Skitter',       hp: 8,   speed: 3.6, radius: 0.4,  damage: 4,  xp: 1,  ai: 'circle',  kbResist: 0,    color: 0xff2e88 },
  { id: 'wraith',  name: 'Wraith',        hp: 30,  speed: 2.9, radius: 0.6,  damage: 10, xp: 5,  ai: 'phase',   kbResist: 0.3,  color: 0x9a6bff },
  { id: 'knight',  name: 'Shield Knight', hp: 110, speed: 2.0, radius: 0.8,  damage: 16, xp: 10, ai: 'shield',  kbResist: 0.7,  color: 0xff3355 },
];
export const K = { HUSK: 0, WISP: 1, BRUTE: 2, SPITTER: 3, BLOATER: 4, SKITTER: 5, WRAITH: 6, KNIGHT: 7 } as const;
export const MAX_ENEMY_RADIUS = 1.3; // elite-scaled brute; used for hash queries
export const ELITE = { hpMult: 3, speedMult: 1.1, dmgMult: 1.25, radiusMult: 1.3, xpMult: 5 };
