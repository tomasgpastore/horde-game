import { K } from './enemies';
/** Wave director tables. "wave" = floor(time / WAVE_LEN)+1. All pacing numbers live here. */
export const WAVE_LEN = 30;
export const VICTORY_TIME = 15 * 60;
export const spawnRate = (t: number) => 1.6 + t * 0.04;            // enemies / second
export const spawnCum = (t: number) => 1.6 * t + 0.02 * t * t;    // integral of spawnRate
export const aliveCap = (t: number) => Math.min(620, 40 + t * 0.95); // soft cap on simultaneous enemies
export const hpScale = (t: number) => 1 + (t / 60) * 0.14;           // +14% hp per minute
export const eliteChance = (t: number) => (t < 120 ? 0 : 0.012 + (t - 120) / 60 * 0.003);
export const SPAWN_DIST = [22, 27] as const; // ring around player
export interface SpawnEntry { kind: number; from: number; to: number; weight: number; pack?: number }
export const SPAWNS: SpawnEntry[] = [
  { kind: K.HUSK,    from: 0,   to: 1e9, weight: 10 },
  { kind: K.WISP,    from: 40,  to: 1e9, weight: 4 },
  { kind: K.SKITTER, from: 80,  to: 1e9, weight: 2, pack: 6 },
  { kind: K.BRUTE,   from: 110, to: 1e9, weight: 2 },
  { kind: K.SPITTER, from: 150, to: 1e9, weight: 3 },
  { kind: K.BLOATER, from: 200, to: 1e9, weight: 2 },
  { kind: K.WRAITH,  from: 280, to: 1e9, weight: 2 },
  { kind: K.KNIGHT,  from: 340, to: 1e9, weight: 2 },
];
