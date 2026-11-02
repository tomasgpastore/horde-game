import type { ArenaDef } from '@shared/types';
import { Biome, buildArena, layoutObstacles } from './builder';
/** World Engineer owns this folder: arena defs, biomes, props, spawn tables (waves.ts). */

function make(id: string, name: string, radius: number, palette: ArenaDef['palette'], b: Biome): ArenaDef {
  const def: ArenaDef = { id, name, radius, obstacles: layoutObstacles(radius, b), palette,
    playerSpawn: [{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: -2, z: 0 }, { x: 0, z: 2 }],
    build(scene) { return buildArena(def, b, scene); } };
  return def;
}

const ashenWoods = make('ashen_woods', 'Ashen Woods', 40,
  { ground: 0x4a4056, fog: 0x1a1722, sky: 0x1a1722, accent: 0xff7a2f, light: 0xffd8a8 },
  { seed: 101, obstacleKinds: ['pillar', 'rock', 'rock'], obstacleCount: 16, obstacleR: [1.2, 2.4], clearRadius: 7,
    scatter: [{ kind: 'bone', count: 70, scale: [0.5, 1.1] }, { kind: 'rock', count: 90, scale: [0.2, 0.55] }, { kind: 'brazier', count: 6, scale: [0.8, 1] }],
    propColors: [0x4a4256, 0x3a3446, 0x5b5266], glowColor: 0xff7a2f, ember: { count: 500, color: 0xff9a4a, rise: 1.6, size: 0.55 },
    groundNoise: [0x4a4056, 0x5f5068], lightIntensity: 2, sunDir: [10, 25, 8] });

const drownedCathedral = make('drowned_cathedral', 'Drowned Cathedral', 46,
  { ground: 0x2f4a42, fog: 0x0f1c1a, sky: 0x0f1c1a, accent: 0x5dffb0, light: 0xbfffe0 },
  { seed: 202, obstacleKinds: ['shroom', 'rock', 'crystal'], obstacleCount: 22, obstacleR: [1, 2.2], clearRadius: 7,
    scatter: [{ kind: 'shroom', count: 80, scale: [0.4, 0.9] }, { kind: 'crystal', count: 40, scale: [0.3, 0.7] }, { kind: 'rock', count: 60, scale: [0.2, 0.5] }],
    propColors: [0x2f4a44, 0x3f6a5a, 0x5a8a6a, 0x7a4a6a], glowColor: 0x5dffb0, ember: { count: 600, color: 0x9dffd0, rise: 0.7, size: 0.5 },
    groundNoise: [0x2f4a42, 0x3f6a58], lightIntensity: 1.5, sunDir: [-12, 22, 10] });

const voidGarden = make('void_garden', 'Void Garden', 32,
  { ground: 0x2e2026, fog: 0x2a0d10, sky: 0x1c080b, accent: 0xff3b2f, light: 0xffa070 },
  { seed: 303, obstacleKinds: ['pillar'], obstacleCount: 10, obstacleR: [1.4, 1.8], clearRadius: 12,
    scatter: [{ kind: 'brazier', count: 12, scale: [0.9, 1.2] }, { kind: 'rock', count: 50, scale: [0.2, 0.5] }, { kind: 'bone', count: 40, scale: [0.6, 1.4] }],
    propColors: [0x2a1f26, 0x3a2a30, 0x4a2a2a], glowColor: 0xff3b2f, ember: { count: 700, color: 0xff5a2a, rise: 2.4, size: 0.6 },
    groundNoise: [0x2e2026, 0x5a2025], ring: { color: 0xff3b2f, r: 14 }, lightIntensity: 1.6, sunDir: [6, 24, 12] });

const arenas: Record<string, ArenaDef> = Object.fromEntries([ashenWoods, drownedCathedral, voidGarden].map(a => [a.id, a]));
export const ARENA_IDS = Object.keys(arenas);
export const getArena = (id: string) => arenas[id] ?? ashenWoods;
