// Pure data + helpers (NO three import) so the deterministic sim can use it.
/** Spawn pacing. Enemy `kind` indexes Gameplay's ENEMIES table (0..2 exist in the stub; extend freely). */
export interface SpawnEntry { kind: number; weight: number }
export interface WaveDef {
  wave: number;               // 1-based
  rate: number;               // enemies / second budget
  cap: number;                // max alive enemies for this wave
  mix: SpawnEntry[];          // weighted kinds
  surge?: { every: number; count: number }; // ring-surge: `count` enemies encircle the player every N seconds
}
/** Global alive-enemy cap (perf budget: 60fps target on mid GPUs). Raise only with QA perf data. */
export const MAX_ALIVE = 400;
/** Runtime cap (Low quality lowers it; set via Game.applySettings). */
export const limits = { maxAlive: MAX_ALIVE };
export const WAVE_SECONDS = 40;
/** Per-arena boss: emitted as bossSpawn at `time` seconds (GDD: min 5/10/15). */
export const ARENA_BOSS: Record<string, { bossId: string; time: number }> = {
  ashen_woods: { bossId: 'hollow_stag', time: 300 },
  drowned_cathedral: { bossId: 'bell_warden', time: 600 },
  void_garden: { bossId: 'the_unlit', time: 900 },
};
const MIXES: SpawnEntry[][] = [
  [{ kind: 0, weight: 1 }],
  [{ kind: 0, weight: 3 }, { kind: 1, weight: 1 }],
  [{ kind: 0, weight: 2 }, { kind: 1, weight: 2 }],
  [{ kind: 0, weight: 2 }, { kind: 1, weight: 2 }, { kind: 2, weight: 1 }],
  [{ kind: 0, weight: 2 }, { kind: 1, weight: 2 }, { kind: 2, weight: 1 }, { kind: 3, weight: 2 }],
  [{ kind: 1, weight: 2 }, { kind: 2, weight: 2 }, { kind: 3, weight: 2 }, { kind: 5, weight: 1 }, { kind: 6, weight: 1 }],
  [{ kind: 2, weight: 2 }, { kind: 3, weight: 2 }, { kind: 4, weight: 1 }, { kind: 5, weight: 2 }, { kind: 7, weight: 2 }],
];
/** Waves are generated from a formula so there is no end to the table; tweak numbers here only. */
export function waveFor(wave: number): WaveDef {
  const w = Math.max(1, wave);
  return {
    wave: w,
    rate: 2.2 + w * 1.0 + Math.pow(w, 1.5) * 0.55,
    cap: Math.min(limits.maxAlive, 70 + w * 50),
    mix: MIXES[Math.min(MIXES.length - 1, Math.floor((w - 1) / 2))],
    surge: w >= 3 ? { every: 26, count: 8 + w * 3 } : undefined,
  };
}
export const waveAt = (time: number) => Math.floor(time / WAVE_SECONDS) + 1;
