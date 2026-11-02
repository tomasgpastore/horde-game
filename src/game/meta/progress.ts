/** Personal bests + recent-run history (localStorage). Meta only: never touches the deterministic sim. */
const KEY = 'emberhorde.meta.v1', MAX_RECENT = 10;
export interface RunResult { kills: number; time: number; level: number; victory?: boolean; weapons?: { id: string; level: number }[] }
export interface RunRecord extends RunResult { arena: string; at: number }
export interface ArenaBest { time: number; kills: number; level: number; runs: number; wins: number }
export type Stat = 'time' | 'kills' | 'level';
/** Returned by record(); also attached to the game:over detail as `records`. */
export interface Records {
  arena: string;
  /** stats that beat a previous best (never flagged on the very first run on an arena) */
  broken: Stat[]; first: boolean;
  prev: ArenaBest | null; best: ArenaBest;
}
interface Store { v: 1; arenas: Record<string, ArenaBest>; recent: RunRecord[] }

const empty = (): Store => ({ v: 1, arenas: {}, recent: [] });
const num = (n: unknown) => (typeof n === 'number' && isFinite(n) && n >= 0 ? n : 0);

export class Meta {
  private s: Store;
  /** Result of the most recent record() call, or null. */
  last: Records | null = null;
  constructor(private storage: Pick<Storage, 'getItem' | 'setItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null) { this.s = this.load(); }
  private load(): Store {
    try {
      const j = JSON.parse(this.storage?.getItem(KEY) ?? 'null');
      if (j && j.v === 1 && j.arenas && Array.isArray(j.recent)) return j;
    } catch { /* corrupt or unavailable: start fresh */ }
    return empty();
  }
  private save() { try { this.storage?.setItem(KEY, JSON.stringify(this.s)); } catch { /* private mode / quota */ } }

  /** Record a finished run; returns which personal bests it broke. Dispatches 'meta:best' on window when any were broken. */
  record(arena: string, r: RunResult): Records {
    const run: RunResult = { kills: num(r.kills), time: num(r.time), level: num(r.level), victory: !!r.victory, weapons: (r.weapons ?? []).map(w => ({ id: String(w.id), level: num(w.level) })) };
    const old = this.s.arenas[arena] ?? null, prev = old ? { ...old } : null;
    const best: ArenaBest = old ?? { time: 0, kills: 0, level: 0, runs: 0, wins: 0 };
    const broken: Stat[] = [];
    for (const k of ['time', 'kills', 'level'] as const) if (run[k] > best[k]) { if (old) broken.push(k); best[k] = run[k]; }
    best.runs++; if (run.victory) best.wins++;
    this.s.arenas[arena] = best;
    this.s.recent.unshift({ ...run, arena, at: Date.now() }); this.s.recent.length = Math.min(this.s.recent.length, MAX_RECENT);
    this.save();
    this.last = { arena, broken, first: !old, prev, best: { ...best } };
    if (broken.length && typeof dispatchEvent === 'function') dispatchEvent(new CustomEvent('meta:best', { detail: this.last }));
    return this.last;
  }
  bests(arena: string): ArenaBest | null { const b = this.s.arenas[arena]; return b ? { ...b } : null; }
  /** Newest first, max 10. */
  recent(): RunRecord[] { return this.s.recent.map(r => ({ ...r })); }
  clear() { this.s = empty(); this.last = null; this.save(); }
}
