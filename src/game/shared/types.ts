// CONTRACTS shared by every module. Changes here need Tech Lead review.
// The sim (src/sim) is PURE: no three.js, no DOM, no Math.random, no Date.now. Fixed timestep => shareable with a Node server.

export const TICK_RATE = 60;
export const TICK_DT = 1 / TICK_RATE;
export const MAX_ENEMIES = 2048;
export const MAX_PROJECTILES = 2048;
export const MAX_PICKUPS = 1024;
export const MAX_PLAYERS = 4;

/** Ground plane is XZ; y is up. The sim only cares about x,z (2D); render adds height. */
export interface PlayerInput {
  moveX: number; moveZ: number;   // -1..1, normalised by sim
  aimX: number; aimZ: number;     // world-space aim direction (unit or 0)
  dash: boolean; ability: boolean; // edge-triggered by InputSource each tick
}
export const EMPTY_INPUT: PlayerInput = { moveX: 0, moveZ: 0, aimX: 0, aimZ: 1, dash: false, ability: false };

/** Struct-of-arrays pools: rendering reads these directly into InstancedMesh. alive[i]=1 means slot used. */
export interface EnemyPool {
  count: number;            // high-water mark; iterate 0..count
  alive: Uint8Array;
  kind: Uint8Array;         // index into content ENEMIES table
  x: Float32Array; z: Float32Array; vx: Float32Array; vz: Float32Array;
  flags: Uint8Array;        // bit0 = elite
  hp: Float32Array; hitFlash: Float32Array; // seconds remaining of hit flash
  facing: Float32Array;     // yaw radians
}
export interface ProjectilePool {
  count: number; alive: Uint8Array; kind: Uint8Array; owner: Uint8Array;
  x: Float32Array; z: Float32Array; vx: Float32Array; vz: Float32Array;
  life: Float32Array; dmg: Float32Array; pierce: Uint8Array;
}
export interface PickupPool {
  count: number; alive: Uint8Array; kind: Uint8Array; // 0 xp gem,1 gold,2 health, ...
  x: Float32Array; z: Float32Array; value: Float32Array; magnet: Uint8Array;
}
export interface PlayerState {
  id: number; active: boolean;
  x: number; z: number; vx: number; vz: number; facing: number;
  hp: number; maxHp: number; level: number; xp: number; xpToNext: number;
  dashTime: number; dashCooldown: number; iframes: number;
  weapons: { id: string; level: number; cooldown: number; evolved?: boolean }[];
  stats: Record<string, number>; // moveSpeed, damageMult, area, pickupRadius...
  dead: boolean;
}

/** One-shot things the sim emits each tick for render/audio/ui (particles, sfx, damage numbers). Cleared every tick. */
export type SimEvent =
  | { t: 'hit'; x: number; z: number; dmg: number; crit: boolean; enemyKind: number }
  | { t: 'kill'; x: number; z: number; enemyKind: number; elite?: boolean }
  | { t: 'shoot'; weapon: string; x: number; z: number; owner: number }
  | { t: 'playerHurt'; id: number; dmg: number }
  | { t: 'pickup'; kind: number; id: number }
  | { t: 'levelUp'; id: number; choices: string[] }
  | { t: 'dash'; id: number }
  | { t: 'waveStart'; wave: number }
  | { t: 'bossSpawn'; x: number; z: number; bossId: string }
  | { t: 'bossDeath'; x: number; z: number; bossId: string }
  | { t: 'freeze'; ms: number }                       // hit-stop request (client skips stepping for ms)
  | { t: 'slow'; scale: number; secs: number }          // slow-mo request (level-up etc.)
  | { t: 'evolve'; id: number; weapon: string }         // weapon reached max level (evolution moment)
  | { t: 'bossTelegraph'; x: number; z: number; dx: number; dz: number; windup: number; bossId: string } // charge wind-up starts (red lane); VFX/audio cue
  | { t: 'bossSlam'; x: number; z: number; bossId: string }                                              // charge ends / impact
  | { t: 'telegraph'; x: number; z: number; kind: number }                                             // an enemy is winding up an attack (spitter: red ring)
  | { t: 'biome'; next: string }                        // boss of this biome died: client swaps arena after the reward card
  | { t: 'gameOver'; victory: boolean };

export interface SimState {
  tick: number; time: number;
  seed: number;
  players: PlayerState[];
  enemies: EnemyPool; projectiles: ProjectilePool; pickups: PickupPool;
  events: SimEvent[];
  phase: 'running' | 'levelUp' | 'gameOver';
  wave: number; kills: number; gold: number; eliteCount: number; swarmCount: number; biomeT0: number; biome: number; bossReward: boolean;
  /** Upgrade ids offered while phase==='levelUp' (sim.choose(index) resolves). */
  levelChoices: string[];
  /** World-owned spawner state (plain numbers => snapshot/rollback safe). */
  /** Active boss (enemy slot `idx`); mode 0 chase, 1 telegraph, 2 charge. */
  boss: { idx: number; id: string; maxHp: number; t: number; mode: number; dx: number; dz: number } | null;
  spawner: { budget: number; nextSurge: number; lastWave: number; boss: boolean; opener?: boolean };
}

/** Arena = world module's contract with sim (collision/spawn) and render (scenery). */
export interface ArenaDef {
  id: string; name: string;
  radius: number;                       // circular playable bounds (sim clamps)
  obstacles: { x: number; z: number; r: number }[]; // circle colliders (pillars, rocks)
  playerSpawn: { x: number; z: number }[];
  palette: { ground: number; fog: number; sky: number; accent: number; light: number };
  build(scene: import('three').Scene): ArenaHandle; // render-side: adds scenery, returns disposer/updater
}
export interface ArenaHandle { update(dt: number, t: number): void; dispose(): void }

/** Transport abstraction: local (in-process) now, WebSocket later. */
export interface NetSession {
  localPlayerId: number;
  sendInput(tick: number, input: PlayerInput): void;
  /** returns inputs for all players for the given tick, or null if not yet available */
  inputsFor(tick: number): PlayerInput[] | null;
  onSnapshot?(cb: (s: Uint8Array) => void): void;
  close(): void;
}
