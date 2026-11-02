import type { SimState, PlayerInput, SimEvent } from '@shared/types';
/** Wire protocol v1 (shared by client + Node server). Pure: no DOM, no node APIs.
 *  Client -> server: binary INPUT (type 1), JSON text {t:'join'|'choose'}.
 *  Server -> client: JSON text {t:'welcome'|'peer'|'error'}, binary SNAPSHOT (type 2, ~20Hz).
 *  Snapshot = header + JSON meta (players, boss, spawner, events since last snapshot) + quantised pools (alive entries only). */
export const PROTO_VERSION = 1;
export const MSG_INPUT = 1, MSG_SNAPSHOT = 2;
export const SNAPSHOT_HZ = 20;
export const INPUT_BYTES = 10;

export function encodeInput(seq: number, i: PlayerInput, out = new Uint8Array(INPUT_BYTES)): Uint8Array {
  const dv = new DataView(out.buffer, out.byteOffset, INPUT_BYTES), q = (v: number) => Math.max(-127, Math.min(127, Math.round(v * 127)));
  dv.setUint8(0, MSG_INPUT); dv.setUint32(1, seq >>> 0);
  dv.setInt8(5, q(i.moveX)); dv.setInt8(6, q(i.moveZ)); dv.setInt8(7, q(i.aimX)); dv.setInt8(8, q(i.aimZ));
  dv.setUint8(9, (i.dash ? 1 : 0) | (i.ability ? 2 : 0));
  return out;
}
export function decodeInput(b: Uint8Array, into: PlayerInput): number | null {
  if (b.length < INPUT_BYTES || b[0] !== MSG_INPUT) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.length);
  into.moveX = dv.getInt8(5) / 127; into.moveZ = dv.getInt8(6) / 127; into.aimX = dv.getInt8(7) / 127; into.aimZ = dv.getInt8(8) / 127;
  const f = dv.getUint8(9); into.dash = (f & 1) !== 0; into.ability = (f & 2) !== 0;
  return dv.getUint32(1);
}

// ---- snapshot ----
const PS = 64, VS = 256, FS = 256 / (Math.PI * 2); // pos 1/64u (+-512), vel 1/256 (+-128), facing 256 steps
const c16 = (v: number) => Math.max(-32768, Math.min(32767, Math.round(v)));
const u16 = (v: number) => Math.max(0, Math.min(65535, Math.round(v)));
const u8 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
const ENEMY_REC = 16, PROJ_REC = 17, PICK_REC = 11;
export const MAX_SNAPSHOT_BYTES = 64 * 1024 * 4;

export interface SnapshotMeta {
  tick: number; time: number; phase: SimState['phase']; wave: number; kills: number; gold: number;
  players: SimState['players']; boss: SimState['boss']; spawner: SimState['spawner']; levelChoices: string[]; events: SimEvent[];
  /** per-slot last input seq the server applied (for client prediction reconciliation) */
  acks: number[];
}
/** Decoded pools, struct-of-arrays, n valid entries (slot = index in sim pool). */
export interface PoolSnap { n: number; hw: number; slot: Uint16Array; kind: Uint8Array; owner: Uint8Array; x: Float32Array; z: Float32Array; vx: Float32Array; vz: Float32Array; a: Float32Array; b: Float32Array }
export interface Snapshot { meta: SnapshotMeta; enemies: PoolSnap; projectiles: PoolSnap; pickups: PoolSnap }

const te = new TextEncoder(), td = new TextDecoder();
let scratch = new Uint8Array(MAX_SNAPSHOT_BYTES);

/** Encode current sim state. `events` = events accumulated since the last snapshot. Returns a fresh copy. */
export function encodeSnapshot(s: SimState, events: SimEvent[], acks: number[]): Uint8Array {
  const meta: SnapshotMeta = { tick: s.tick, time: s.time, phase: s.phase, wave: s.wave, kills: s.kills, gold: s.gold, players: s.players, boss: s.boss, spawner: s.spawner, levelChoices: s.levelChoices, events, acks };
  const json = te.encode(JSON.stringify(meta));
  const e = s.enemies, p = s.projectiles, k = s.pickups;
  const need = 1 + 4 + json.length + 6 * 3 + e.count * ENEMY_REC + p.count * PROJ_REC + k.count * PICK_REC;
  if (scratch.length < need) scratch = new Uint8Array(need * 2);
  const dv = new DataView(scratch.buffer); let o = 0;
  dv.setUint8(o++, MSG_SNAPSHOT); dv.setUint32(o, json.length); o += 4; scratch.set(json, o); o += json.length;
  let cnt = o; o += 4; let n = 0; dv.setUint16(cnt + 2, e.count);
  for (let i = 0; i < e.count; i++) if (e.alive[i]) { n++;
    dv.setUint16(o, i); dv.setUint8(o + 2, e.kind[i]); dv.setInt16(o + 3, c16(e.x[i] * PS)); dv.setInt16(o + 5, c16(e.z[i] * PS));
    dv.setInt16(o + 7, c16(e.vx[i] * VS)); dv.setInt16(o + 9, c16(e.vz[i] * VS)); dv.setUint8(o + 11, u8((((e.facing[i] % 6.2832) + 6.2832) % 6.2832) * FS));
    dv.setUint16(o + 12, u16(e.hp[i])); dv.setUint8(o + 14, u8(e.hitFlash[i] * 255)); o += ENEMY_REC - 1; }
  dv.setUint16(cnt, n);
  cnt = o; o += 4; n = 0; dv.setUint16(cnt + 2, p.count);
  for (let i = 0; i < p.count; i++) if (p.alive[i]) { n++;
    dv.setUint16(o, i); dv.setUint8(o + 2, p.kind[i]); dv.setUint8(o + 3, p.owner[i]); dv.setInt16(o + 4, c16(p.x[i] * PS)); dv.setInt16(o + 6, c16(p.z[i] * PS));
    dv.setInt16(o + 8, c16(p.vx[i] * VS)); dv.setInt16(o + 10, c16(p.vz[i] * VS)); dv.setUint16(o + 12, u16(p.life[i] * 1000)); o += PROJ_REC - 3; }
  dv.setUint16(cnt, n);
  cnt = o; o += 4; n = 0; dv.setUint16(cnt + 2, k.count);
  for (let i = 0; i < k.count; i++) if (k.alive[i]) { n++;
    dv.setUint16(o, i); dv.setUint8(o + 2, k.kind[i]); dv.setInt16(o + 3, c16(k.x[i] * PS)); dv.setInt16(o + 5, c16(k.z[i] * PS));
    dv.setUint16(o + 7, u16(k.value[i])); dv.setUint8(o + 9, k.magnet[i]); o += PICK_REC - 1; }
  dv.setUint16(cnt, n);
  return scratch.slice(0, o);
}

function poolSnap(cap: number): PoolSnap {
  const f = () => new Float32Array(cap);
  return { n: 0, hw: 0, slot: new Uint16Array(cap), kind: new Uint8Array(cap), owner: new Uint8Array(cap), x: f(), z: f(), vx: f(), vz: f(), a: f(), b: f() };
}
/** Decode. Pass a previous Snapshot as `reuse` to avoid allocation. enemies.a = hp, .b = hitFlash(s), vx/vz as sent; for enemies facing is in `owner`-free field: see facing(). */
export function decodeSnapshot(buf: Uint8Array, reuse?: Snapshot): Snapshot | null {
  if (buf[0] !== MSG_SNAPSHOT) return null;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.length); let o = 1;
  const jl = dv.getUint32(o); o += 4;
  const meta = JSON.parse(td.decode(buf.subarray(o, o + jl))) as SnapshotMeta; o += jl;
  const snap = reuse ?? { meta, enemies: poolSnap(2048), projectiles: poolSnap(2048), pickups: poolSnap(1024) };
  snap.meta = meta;
  let P = snap.enemies; let n = dv.getUint16(o); P.hw = dv.getUint16(o + 2); o += 4; P.n = n;
  for (let i = 0; i < n; i++) {
    P.slot[i] = dv.getUint16(o); P.kind[i] = dv.getUint8(o + 2); P.x[i] = dv.getInt16(o + 3) / PS; P.z[i] = dv.getInt16(o + 5) / PS;
    P.vx[i] = dv.getInt16(o + 7) / VS; P.vz[i] = dv.getInt16(o + 9) / VS; P.owner[i] = dv.getUint8(o + 11); /* facing step */
    P.a[i] = dv.getUint16(o + 12); P.b[i] = dv.getUint8(o + 14) / 255; o += ENEMY_REC - 1; }
  P = snap.projectiles; n = dv.getUint16(o); P.hw = dv.getUint16(o + 2); o += 4; P.n = n;
  for (let i = 0; i < n; i++) {
    P.slot[i] = dv.getUint16(o); P.kind[i] = dv.getUint8(o + 2); P.owner[i] = dv.getUint8(o + 3); P.x[i] = dv.getInt16(o + 4) / PS; P.z[i] = dv.getInt16(o + 6) / PS;
    P.vx[i] = dv.getInt16(o + 8) / VS; P.vz[i] = dv.getInt16(o + 10) / VS; P.a[i] = dv.getUint16(o + 12) / 1000; o += PROJ_REC - 3; }
  P = snap.pickups; n = dv.getUint16(o); P.hw = dv.getUint16(o + 2); o += 4; P.n = n;
  for (let i = 0; i < n; i++) {
    P.slot[i] = dv.getUint16(o); P.kind[i] = dv.getUint8(o + 2); P.x[i] = dv.getInt16(o + 3) / PS; P.z[i] = dv.getInt16(o + 5) / PS;
    P.a[i] = dv.getUint16(o + 7); P.owner[i] = dv.getUint8(o + 9); /* magnet */ o += PICK_REC - 1; }
  return snap;
}
/** Enemy facing (radians) from the quantised step stored in enemies.owner. */
export const facingOf = (step: number) => step / FS;
