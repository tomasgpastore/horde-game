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
/** Per-biome boss: emitted as bossSpawn `time` seconds AFTER the biome started (SimState.biomeT0) — GDD: ~5/10/15 min for a steady run. */
export const ARENA_BOSS: Record<string, { bossId: string; time: number }> = {
  ashen_woods: { bossId: 'hollow_stag', time: 300 },
  drowned_cathedral: { bossId: 'bell_warden', time: 270 },
  void_garden: { bossId: 'the_unlit', time: 270 },
};
/** Run order: killing a biome's boss opens the next biome; killing The Unlit wins the run. */
export const NEXT_ARENA: Record<string, string | null> = { ashen_woods: 'drowned_cathedral', drowned_cathedral: 'void_garden', void_garden: null };
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
    rate: 3.0 + w * 1.6 + Math.pow(w, 1.5) * 0.3,
    cap: Math.min(limits.maxAlive, capAt(w * WAVE_SECONDS - WAVE_SECONDS / 2)),
    mix: MIXES[Math.min(MIXES.length - 1, Math.floor((w - 1) / 2))],
    surge: { every: 26, count: 8 + w * 3 }, // first ring at 14s (nextSurge), from wave 1 (Designer #84)
  };
}
/** Alive-enemy target over time (s -> cap): fairer early curve (~50 @0:30, ~85 @1:00) + Designer's late scaling (150 @5:00, 280 @10:00, 420 @15:00; see content/balance.ts SPAWN_SEGMENTS). */
const CAP_POINTS: [number, number][] = [[0, 45], [30, 50], [60, 85], [120, 100], [180, 115], [300, 200], [480, 290], [600, 340], [900, 420]];
export function capAt(t: number): number {
  if (t <= 0) return CAP_POINTS[0][1];
  for (let i = 1; i < CAP_POINTS.length; i++) if (t <= CAP_POINTS[i][0]) { const [t0, c0] = CAP_POINTS[i - 1], [t1, c1] = CAP_POINTS[i]; return Math.round(c0 + (c1 - c0) * (t - t0) / (t1 - t0)); }
  return Math.min(MAX_ALIVE, CAP_POINTS[CAP_POINTS.length - 1][1] + Math.round((t - 900) / 60 * 20));
}
export const waveAt = (time: number) => Math.floor(time / WAVE_SECONDS) + 1;
