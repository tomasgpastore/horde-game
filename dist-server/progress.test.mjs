// src/game/meta/progress.ts
var KEY = "emberhorde.meta.v1";
var MAX_RECENT = 10;
var empty = () => ({ v: 1, arenas: {}, recent: [] });
var num = (n) => typeof n === "number" && isFinite(n) && n >= 0 ? n : 0;
var Meta = class {
  constructor(storage = typeof localStorage !== "undefined" ? localStorage : null) {
    this.storage = storage;
    this.s = this.load();
  }
  storage;
  s;
  /** Result of the most recent record() call, or null. */
  last = null;
  load() {
    try {
      const j = JSON.parse(this.storage?.getItem(KEY) ?? "null");
      if (j && j.v === 1 && j.arenas && Array.isArray(j.recent)) return j;
    } catch {
    }
    return empty();
  }
  save() {
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.s));
    } catch {
    }
  }
  /** Record a finished run; returns which personal bests it broke. Dispatches 'meta:best' on window when any were broken. */
  record(arena, r) {
    const run = { kills: num(r.kills), time: num(r.time), level: num(r.level), victory: !!r.victory, weapons: (r.weapons ?? []).map((w) => ({ id: String(w.id), level: num(w.level) })) };
    const old = this.s.arenas[arena] ?? null, prev = old ? { ...old } : null;
    const best = old ?? { time: 0, kills: 0, level: 0, runs: 0, wins: 0 };
    const broken = [];
    for (const k of ["time", "kills", "level"]) if (run[k] > best[k]) {
      if (old) broken.push(k);
      best[k] = run[k];
    }
    best.runs++;
    if (run.victory) best.wins++;
    this.s.arenas[arena] = best;
    this.s.recent.unshift({ ...run, arena, at: Date.now() });
    this.s.recent.length = Math.min(this.s.recent.length, MAX_RECENT);
    this.save();
    this.last = { arena, broken, first: !old, prev, best: { ...best } };
    if (broken.length && typeof dispatchEvent === "function") dispatchEvent(new CustomEvent("meta:best", { detail: this.last }));
    return this.last;
  }
  bests(arena) {
    const b = this.s.arenas[arena];
    return b ? { ...b } : null;
  }
  /** Newest first, max 10. */
  recent() {
    return this.s.recent.map((r) => ({ ...r }));
  }
  clear() {
    this.s = empty();
    this.last = null;
    this.save();
  }
};
export {
  Meta
};
