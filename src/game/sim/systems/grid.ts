import type { System } from '../system';
import { MAX_ENEMIES } from '@shared/types';
/** Uniform spatial hash over enemies, rebuilt each tick (derived data, not sim state). */
export const CELL = 2, DIM = 64, OFF = DIM / 2 * CELL; // covers [-64,64)
export const head = new Int16Array(DIM * DIM), next = new Int16Array(MAX_ENEMIES);
const cx = (v: number) => Math.min(DIM - 1, Math.max(0, Math.floor((v + OFF) / CELL)));
export const cellOf = (x: number, z: number) => cx(z) * DIM + cx(x);
export const cellX = cx;
export const gridSystem: System = { name: 'grid', update(s) {
  head.fill(-1); const e = s.enemies;
  for (let i = 0; i < e.count; i++) if (e.alive[i]) { const c = cellOf(e.x[i], e.z[i]); next[i] = head[c]; head[c] = i; }
} };
