import { MAX_ENEMIES, type EnemyPool } from '@shared/types';
/** Uniform-grid spatial hash over enemies (counting sort, zero alloc per tick). Rebuilt fully by enemy system, so safe to share across Sim instances. */
const CELL = 2.5;
let W = 0, half = 0;
let cellStart = new Int32Array(0), cellCnt = new Int32Array(0);
const items = new Int32Array(MAX_ENEMIES), cellOf = new Int32Array(MAX_ENEMIES);
export const near = { out: new Int32Array(768) };
const cx = (v: number) => { const c = Math.floor((v + half) / CELL); return c < 0 ? 0 : c >= W ? W - 1 : c; };
export function rebuild(e: EnemyPool, arenaRadius: number) {
  const w = Math.ceil((arenaRadius + 8) * 2 / CELL);
  if (w !== W) { W = w; half = (arenaRadius + 8); cellStart = new Int32Array(W * W + 1); cellCnt = new Int32Array(W * W); }
  cellCnt.fill(0);
  for (let i = 0; i < e.count; i++) { if (!e.alive[i]) continue; const c = cx(e.z[i]) * W + cx(e.x[i]); cellOf[i] = c; cellCnt[c]++; }
  let acc = 0; for (let c = 0; c < W * W; c++) { cellStart[c] = acc; acc += cellCnt[c]; cellCnt[c] = 0; }
  cellStart[W * W] = acc;
  for (let i = 0; i < e.count; i++) { if (!e.alive[i]) continue; const c = cellOf[i]; items[cellStart[c] + cellCnt[c]++] = i; }
}
/** Fills near.out with enemy indices in cells overlapping the circle; returns count. Callers do the exact distance test + alive check. */
export function query(x: number, z: number, r: number): number {
  const x0 = cx(x - r), x1 = cx(x + r), z0 = cx(z - r), z1 = cx(z + r), out = near.out; let n = 0;
  for (let gz = z0; gz <= z1; gz++) for (let gx = x0; gx <= x1; gx++) {
    const c = gz * W + gx, s = cellStart[c], e = s + cellCnt[c];
    for (let k = s; k < e && n < out.length; k++) out[n++] = items[k];
  }
  return n;
}
