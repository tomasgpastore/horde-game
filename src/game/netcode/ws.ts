import { SimState, PlayerInput, NetSession, TICK_DT } from '@shared/types';
import { encodeInput, decodeSnapshot, facingOf, Snapshot, PoolSnap } from './protocol';

/** Browser client for the authoritative server. Implements NetSession; the Game calls `tick(input)` once per 60Hz step instead of Sim.step:
 *  it sends the input, then writes an interpolated view of the server state into the Game's SimState (renderer/HUD/audio read it as usual).
 *  Remote entities render INTERP_MS in the past; the local hero is predicted and reconciled against server acks. */
export const INTERP_MS = 100;
interface Stamped { snap: Snapshot; at: number }
interface Hist { seq: number; mx: number; mz: number }

export class WsSession implements NetSession {
  localPlayerId = 0; ws: WebSocket; ready = false; error: string | null = null; room = ''; seed = 0; arena = ''; peers = 1; rtt = 0;
  private buf: Stamped[] = []; private seq = 0; private hist: Hist[] = []; private lastEvTick = -1;
  /** predicted local hero position (world units) + residual error blended out */
  px = 0; pz = 0; radius = 1e9; private pInit = false;
  private pool: Snapshot[] = []; onWelcome?: () => void; onClose?: (reason: string) => void;
  constructor(url: string, room?: string, arena?: string) {
    this.ws = new WebSocket(url); this.ws.binaryType = 'arraybuffer';
    this.ws.onopen = () => this.ws.send(JSON.stringify({ t: 'join', room, arena }));
    this.ws.onmessage = (e) => {
      if (typeof e.data !== 'string') { const s = decodeSnapshot(new Uint8Array(e.data), this.pool.pop()); if (s) { this.buf.push({ snap: s, at: performance.now() }); while (this.buf.length > 8) this.pool.push(this.buf.shift()!.snap); } return; }
      const m = JSON.parse(e.data);
      if (m.t === 'welcome') { this.localPlayerId = m.slot; this.room = m.room; this.seed = m.seed; this.arena = m.arena; this.ready = true; this.onWelcome?.(); }
      else if (m.t === 'peer') this.peers = m.count;
      else if (m.t === 'error') { this.error = m.msg; this.close(); }
      else if (m.t === 'pong') this.rtt = performance.now() - m.c;
    };
    this.ws.onclose = (e) => { this.ready = false; this.onClose?.(this.error ?? (e.reason || 'closed')); };
    setTimeout(() => this.ping(), 1000);
  }
  private ping() { if (this.ws.readyState === 1) { this.ws.send(JSON.stringify({ t: 'ping', c: performance.now() })); setTimeout(() => this.ping(), 2000); } }
  sendInput(_tick: number, i: PlayerInput) {
    if (this.ws.readyState !== 1) return; const seq = ++this.seq;
    this.hist.push({ seq, mx: i.moveX, mz: i.moveZ }); if (this.hist.length > 120) this.hist.shift();
    this.ws.send(encodeInput(seq, i));
  }
  inputsFor() { return null; }
  choose(i: number) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify({ t: 'choose', i })); }
  close() { try { this.ws.close(); } catch {} }
  get connected() { return this.ready && this.ws.readyState === 1; }

  /** One 60Hz client step: send input, advance prediction, write the view into `state`. */
  tick(inp: PlayerInput, state: SimState, now = performance.now()) {
    const me = state.players[this.localPlayerId];
    this.sendInput(0, inp);
    const last = this.buf[this.buf.length - 1];
    if (!last) return;
    // reconcile: server pos at ack + replay unacked inputs
    const sp = last.snap.meta.players[this.localPlayerId], ack = last.snap.meta.acks[this.localPlayerId];
    if (sp) {
      let x = sp.x, z = sp.z; const spd = sp.stats.moveSpeed ?? 6, R = this.radius;
      for (const h of this.hist) if (h.seq > ack) { let mx = h.mx, mz = h.mz; const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; } x += mx * spd * TICK_DT; z += mz * spd * TICK_DT; }
      const d = Math.hypot(x, z); if (d > R) { x *= R / d; z *= R / d; }
      if (!this.pInit || Math.hypot(x - this.px, z - this.pz) > 3 || sp.dashTime > 0 || sp.dead) { this.px = x; this.pz = z; this.pInit = true; }
      else { const k = 1 - Math.exp(-12 * TICK_DT); this.px += (x - this.px) * k; this.pz += (z - this.pz) * k; }
    }
    this.sample(state, now);
    if (me && this.pInit && !me.dead) { me.x = this.px; me.z = this.pz; }
  }

  /** Interpolated view at now-INTERP_MS written into state. */
  sample(state: SimState, now: number) {
    const buf = this.buf; if (!buf.length) return;
    const rt = now - INTERP_MS; let bi = buf.findIndex(b => b.at >= rt);
    if (bi < 0) bi = buf.length - 1; const B = buf[bi], A = buf[Math.max(0, bi - 1)];
    const span = B.at - A.at, f = bi === 0 || span <= 0 ? 1 : Math.max(0, Math.min(1, (rt - A.at) / span));
    const m = B.snap.meta;
    state.tick = m.tick; state.time = m.time; state.phase = m.phase; state.wave = m.wave; state.kills = m.kills; state.gold = m.gold;
    state.boss = m.boss; state.spawner = m.spawner; state.levelChoices = m.levelChoices;
    // events: deliver once, when the render clock reaches a snapshot
    state.events.length = 0;
    for (const b of buf) if (b.snap.meta.tick > this.lastEvTick && b.at <= rt + 17) { for (const e of b.snap.meta.events) state.events.push(e); this.lastEvTick = b.snap.meta.tick; }
    for (let i = 0; i < state.players.length; i++) {
      const pa = A.snap.meta.players[i], pb = m.players[i], dst = state.players[i]; if (!pb) continue;
      Object.assign(dst, pb);
      if (pa && pb.active && pa.active && i !== this.localPlayerId && Math.hypot(pb.x - pa.x, pb.z - pa.z) < 6) { dst.x = pa.x + (pb.x - pa.x) * f; dst.z = pa.z + (pb.z - pa.z) * f; }
    }
    const e = state.enemies, pe = B.snap.enemies, ae = A.snap.enemies;
    this.fillPool(state.enemies.alive, e.count, state.enemies.hp, pe, ae, f, (d, j, s) => {
      e.kind[d] = pe.kind[s]; e.vx[d] = pe.vx[s]; e.vz[d] = pe.vz[s]; e.hp[d] = pe.a[s]; e.hitFlash[d] = pe.b[s]; e.facing[d] = facingOf(pe.owner[s]);
    }, e.x, e.z); e.count = pe.hw;
    const p = state.projectiles, pp = B.snap.projectiles;
    this.fillPool(p.alive, p.count, p.life, pp, A.snap.projectiles, f, (d, j, s) => { p.kind[d] = pp.kind[s]; p.owner[d] = pp.owner[s]; p.vx[d] = pp.vx[s]; p.vz[d] = pp.vz[s]; p.life[d] = pp.a[s]; }, p.x, p.z); p.count = pp.hw;
    const k = state.pickups, pk = B.snap.pickups;
    this.fillPool(k.alive, k.count, k.value, pk, A.snap.pickups, f, (d, j, s) => { k.kind[d] = pk.kind[s]; k.value[d] = pk.a[s]; k.magnet[d] = pk.owner[s]; }, k.x, k.z); k.count = pk.hw;
  }

  private idx = new Int32Array(2048).fill(-1); private idxFor: PoolSnap | null = null;
  private fillPool(alive: Uint8Array, oldCount: number, _tag: Float32Array, B: PoolSnap, A: PoolSnap, f: number, copy: (dst: number, j: number, src: number) => void, X: Float32Array, Z: Float32Array) {
    alive.fill(0, 0, Math.max(oldCount, B.hw));
    // slot -> index in A (only when A is a different snapshot)
    const useA = A !== B && f < 1; let map = this.idx;
    if (useA) { map.fill(-1, 0, A.hw + 1); for (let i = 0; i < A.n; i++) map[A.slot[i]] = i; }
    for (let j = 0; j < B.n; j++) {
      const d = B.slot[j]; alive[d] = 1; copy(d, j, j);
      let x = B.x[j], z = B.z[j];
      if (useA) { const a = map[d]; if (a >= 0) { const ax = A.x[a], az = A.z[a]; if ((x - ax) ** 2 + (z - az) ** 2 < 25) { x = ax + (x - ax) * f; z = az + (z - az) * f; } } }
      X[d] = x; Z[d] = z;
    }
  }
}
