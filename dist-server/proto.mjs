// src/game/netcode/protocol.ts
var PROTO_VERSION = 1;
var MSG_INPUT = 1;
var MSG_SNAPSHOT = 2;
var SNAPSHOT_HZ = 20;
var INPUT_BYTES = 10;
function encodeInput(seq, i, out = new Uint8Array(INPUT_BYTES)) {
  const dv = new DataView(out.buffer, out.byteOffset, INPUT_BYTES), q = (v) => Math.max(-127, Math.min(127, Math.round(v * 127)));
  dv.setUint8(0, MSG_INPUT);
  dv.setUint32(1, seq >>> 0);
  dv.setInt8(5, q(i.moveX));
  dv.setInt8(6, q(i.moveZ));
  dv.setInt8(7, q(i.aimX));
  dv.setInt8(8, q(i.aimZ));
  dv.setUint8(9, (i.dash ? 1 : 0) | (i.ability ? 2 : 0));
  return out;
}
function decodeInput(b, into) {
  if (b.length < INPUT_BYTES || b[0] !== MSG_INPUT) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.length);
  into.moveX = dv.getInt8(5) / 127;
  into.moveZ = dv.getInt8(6) / 127;
  into.aimX = dv.getInt8(7) / 127;
  into.aimZ = dv.getInt8(8) / 127;
  const f = dv.getUint8(9);
  into.dash = (f & 1) !== 0;
  into.ability = (f & 2) !== 0;
  return dv.getUint32(1);
}
var PS = 64;
var VS = 256;
var FS = 256 / (Math.PI * 2);
var c16 = (v) => Math.max(-32768, Math.min(32767, Math.round(v)));
var u16 = (v) => Math.max(0, Math.min(65535, Math.round(v)));
var u8 = (v) => Math.max(0, Math.min(255, Math.round(v)));
var ENEMY_REC = 16;
var PROJ_REC = 17;
var PICK_REC = 11;
var MAX_SNAPSHOT_BYTES = 64 * 1024 * 4;
var te = new TextEncoder();
var td = new TextDecoder();
var scratch = new Uint8Array(MAX_SNAPSHOT_BYTES);
function encodeSnapshot(s, events, acks) {
  const meta = { tick: s.tick, time: s.time, phase: s.phase, wave: s.wave, kills: s.kills, gold: s.gold, players: s.players, boss: s.boss, spawner: s.spawner, levelChoices: s.levelChoices, events, acks };
  const json = te.encode(JSON.stringify(meta));
  const e = s.enemies, p = s.projectiles, k = s.pickups;
  const need = 1 + 4 + json.length + 6 * 3 + e.count * ENEMY_REC + p.count * PROJ_REC + k.count * PICK_REC;
  if (scratch.length < need) scratch = new Uint8Array(need * 2);
  const dv = new DataView(scratch.buffer);
  let o = 0;
  dv.setUint8(o++, MSG_SNAPSHOT);
  dv.setUint32(o, json.length);
  o += 4;
  scratch.set(json, o);
  o += json.length;
  let cnt = o;
  o += 4;
  let n = 0;
  dv.setUint16(cnt + 2, e.count);
  for (let i = 0; i < e.count; i++) if (e.alive[i]) {
    n++;
    dv.setUint16(o, i);
    dv.setUint8(o + 2, e.kind[i]);
    dv.setInt16(o + 3, c16(e.x[i] * PS));
    dv.setInt16(o + 5, c16(e.z[i] * PS));
    dv.setInt16(o + 7, c16(e.vx[i] * VS));
    dv.setInt16(o + 9, c16(e.vz[i] * VS));
    dv.setUint8(o + 11, u8((e.facing[i] % 6.2832 + 6.2832) % 6.2832 * FS));
    dv.setUint16(o + 12, u16(e.hp[i]));
    dv.setUint8(o + 14, u8(e.hitFlash[i] * 255));
    o += ENEMY_REC - 1;
  }
  dv.setUint16(cnt, n);
  cnt = o;
  o += 4;
  n = 0;
  dv.setUint16(cnt + 2, p.count);
  for (let i = 0; i < p.count; i++) if (p.alive[i]) {
    n++;
    dv.setUint16(o, i);
    dv.setUint8(o + 2, p.kind[i]);
    dv.setUint8(o + 3, p.owner[i]);
    dv.setInt16(o + 4, c16(p.x[i] * PS));
    dv.setInt16(o + 6, c16(p.z[i] * PS));
    dv.setInt16(o + 8, c16(p.vx[i] * VS));
    dv.setInt16(o + 10, c16(p.vz[i] * VS));
    dv.setUint16(o + 12, u16(p.life[i] * 1e3));
    o += PROJ_REC - 3;
  }
  dv.setUint16(cnt, n);
  cnt = o;
  o += 4;
  n = 0;
  dv.setUint16(cnt + 2, k.count);
  for (let i = 0; i < k.count; i++) if (k.alive[i]) {
    n++;
    dv.setUint16(o, i);
    dv.setUint8(o + 2, k.kind[i]);
    dv.setInt16(o + 3, c16(k.x[i] * PS));
    dv.setInt16(o + 5, c16(k.z[i] * PS));
    dv.setUint16(o + 7, u16(k.value[i]));
    dv.setUint8(o + 9, k.magnet[i]);
    o += PICK_REC - 1;
  }
  dv.setUint16(cnt, n);
  return scratch.slice(0, o);
}
function poolSnap(cap) {
  const f = () => new Float32Array(cap);
  return { n: 0, hw: 0, slot: new Uint16Array(cap), kind: new Uint8Array(cap), owner: new Uint8Array(cap), x: f(), z: f(), vx: f(), vz: f(), a: f(), b: f() };
}
function decodeSnapshot(buf, reuse) {
  if (buf[0] !== MSG_SNAPSHOT) return null;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.length);
  let o = 1;
  const jl = dv.getUint32(o);
  o += 4;
  const meta = JSON.parse(td.decode(buf.subarray(o, o + jl)));
  o += jl;
  const snap = reuse ?? { meta, enemies: poolSnap(2048), projectiles: poolSnap(2048), pickups: poolSnap(1024) };
  snap.meta = meta;
  let P = snap.enemies;
  let n = dv.getUint16(o);
  P.hw = dv.getUint16(o + 2);
  o += 4;
  P.n = n;
  for (let i = 0; i < n; i++) {
    P.slot[i] = dv.getUint16(o);
    P.kind[i] = dv.getUint8(o + 2);
    P.x[i] = dv.getInt16(o + 3) / PS;
    P.z[i] = dv.getInt16(o + 5) / PS;
    P.vx[i] = dv.getInt16(o + 7) / VS;
    P.vz[i] = dv.getInt16(o + 9) / VS;
    P.owner[i] = dv.getUint8(o + 11);
    P.a[i] = dv.getUint16(o + 12);
    P.b[i] = dv.getUint8(o + 14) / 255;
    o += ENEMY_REC - 1;
  }
  P = snap.projectiles;
  n = dv.getUint16(o);
  P.hw = dv.getUint16(o + 2);
  o += 4;
  P.n = n;
  for (let i = 0; i < n; i++) {
    P.slot[i] = dv.getUint16(o);
    P.kind[i] = dv.getUint8(o + 2);
    P.owner[i] = dv.getUint8(o + 3);
    P.x[i] = dv.getInt16(o + 4) / PS;
    P.z[i] = dv.getInt16(o + 6) / PS;
    P.vx[i] = dv.getInt16(o + 8) / VS;
    P.vz[i] = dv.getInt16(o + 10) / VS;
    P.a[i] = dv.getUint16(o + 12) / 1e3;
    o += PROJ_REC - 3;
  }
  P = snap.pickups;
  n = dv.getUint16(o);
  P.hw = dv.getUint16(o + 2);
  o += 4;
  P.n = n;
  for (let i = 0; i < n; i++) {
    P.slot[i] = dv.getUint16(o);
    P.kind[i] = dv.getUint8(o + 2);
    P.x[i] = dv.getInt16(o + 3) / PS;
    P.z[i] = dv.getInt16(o + 5) / PS;
    P.a[i] = dv.getUint16(o + 7);
    P.owner[i] = dv.getUint8(o + 9);
    o += PICK_REC - 1;
  }
  return snap;
}
var facingOf = (step) => step / FS;
export {
  INPUT_BYTES,
  MAX_SNAPSHOT_BYTES,
  MSG_INPUT,
  MSG_SNAPSHOT,
  PROTO_VERSION,
  SNAPSHOT_HZ,
  decodeInput,
  decodeSnapshot,
  encodeInput,
  encodeSnapshot,
  facingOf
};
