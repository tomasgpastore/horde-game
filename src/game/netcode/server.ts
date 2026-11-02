import { PlayerInput, EMPTY_INPUT, TICK_RATE, MAX_PLAYERS, SimEvent } from '@shared/types';
import { Sim, createState } from '@sim/index';
import { getArena } from '@world/index';
import { decodeInput, encodeSnapshot, PROTO_VERSION, SNAPSHOT_HZ, MSG_INPUT } from './protocol';
import { hashState } from './hash';

/** Authoritative co-op server. Bundled with the sim by esbuild into dist-server/net.mjs and loaded by server/index.js.
 *  Drop-in/drop-out rooms of up to MAX_PLAYERS; one room = one Sim at 60Hz; snapshots at SNAPSHOT_HZ. */
export interface Socket { send(d: any): void; close(code?: number): void; on(ev: string, cb: (...a: any[]) => void): void; readyState: number }

const STEP_MS = 1000 / TICK_RATE, MAX_CATCHUP = 5, SNAP_EVERY = Math.round(TICK_RATE / SNAPSHOT_HZ);
const EMPTY_GRACE_MS = 15000, OVER_GRACE_MS = 20000, LEVEL_AUTOPICK_TICKS = 6 * TICK_RATE, IDLE_INPUT_MS = 3000;

interface Client { ws: Socket; slot: number; input: PlayerInput; dash: boolean; ability: boolean; seq: number; lastInput: number; room: Room }

export class Room {
  sim: Sim; clients: (Client | null)[] = Array(MAX_PLAYERS).fill(null); acc = 0; lastT = performance.now();
  pendingEvents: SimEvent[] = []; emptySince = 0; overAt = 0; levelTicks = 0; steps = 0; closed = false; inputs: PlayerInput[] = [];
  constructor(public id: string, public seed: number, public arenaId: string) {
    const arena = getArena(arenaId);
    this.sim = new Sim(createState(seed, arena, 0), arena); // all slots inactive until players join
    for (let i = 0; i < MAX_PLAYERS; i++) this.inputs.push({ ...EMPTY_INPUT });
  }
  get count() { return this.clients.filter(Boolean).length; }
  get joinable() { return !this.closed && this.count < MAX_PLAYERS && this.sim.state.phase !== 'gameOver'; }
  add(ws: Socket): Client | null {
    const slot = this.clients.findIndex(c => !c); if (slot < 0) return null;
    const c: Client = { ws, slot, input: { ...EMPTY_INPUT }, dash: false, ability: false, seq: 0, lastInput: performance.now(), room: this };
    this.clients[slot] = c; const p = this.sim.state.players[slot];
    const sp = this.sim.arena.playerSpawn[slot % this.sim.arena.playerSpawn.length];
    // (re)spawn the slot as a fresh hero
    const fresh = createState(this.seed, this.sim.arena, MAX_PLAYERS).players[slot]; Object.assign(p, fresh, { x: sp.x, z: sp.z, active: true });
    this.emptySince = 0; return c;
  }
  remove(c: Client) { if (this.clients[c.slot] !== c) return; this.clients[c.slot] = null; this.sim.state.players[c.slot].active = false; if (!this.count) this.emptySince = performance.now(); }
  broadcastText(msg: object, except?: Client) { const t = JSON.stringify(msg); for (const c of this.clients) if (c && c !== except && c.ws.readyState === 1) c.ws.send(t); }
  /** Advance by wall-clock; returns false when the room should be destroyed. */
  update(now: number): boolean {
    if (this.closed) return false;
    if (!this.count) return now - this.emptySince < EMPTY_GRACE_MS; // paused while empty
    this.acc = Math.min(this.acc + (now - this.lastT), MAX_CATCHUP * STEP_MS); this.lastT = now;
    const s = this.sim.state;
    while (this.acc >= STEP_MS) {
      this.acc -= STEP_MS;
      for (let i = 0; i < MAX_PLAYERS; i++) {
        const c = this.clients[i], t = this.inputs[i];
        if (!c) { Object.assign(t, EMPTY_INPUT); continue; }
        Object.assign(t, c.input); if (now - c.lastInput > IDLE_INPUT_MS) { t.moveX = t.moveZ = 0; }
        t.dash = c.dash; t.ability = c.ability; c.dash = c.ability = false; // latched edges consumed once
      }
      if (s.phase === 'levelUp') { if (++this.levelTicks > LEVEL_AUTOPICK_TICKS) { this.sim.choose(0); this.levelTicks = 0; } } // TODO per-player once sim supports it
      else { this.levelTicks = 0; this.sim.step(this.inputs); }
      for (const e of s.events) this.pendingEvents.push(e);
      if (this.pendingEvents.length > 512) this.pendingEvents.length = 512;
      if (++this.steps % SNAP_EVERY === 0) this.snapshot();
      if (s.phase === 'gameOver' && !this.overAt) this.overAt = now;
    }
    return !(this.overAt && now - this.overAt > OVER_GRACE_MS);
  }
  snapshot() {
    const acks = this.clients.map(c => c ? c.seq : 0);
    const buf = encodeSnapshot(this.sim.state, this.pendingEvents, acks); this.pendingEvents = [];
    for (const c of this.clients) if (c && c.ws.readyState === 1) { if ((c.ws as any).bufferedAmount > 1 << 20) continue; /* slow client: skip frame */ c.ws.send(buf); }
  }
  hash() { return hashState(this.sim.state, this.sim.rng.s); }
}

export class RoomManager {
  rooms = new Map<string, Room>(); private timer: ReturnType<typeof setInterval>;
  constructor(public opts: { arena?: string; seed?: () => number } = {}) { this.timer = setInterval(() => this.tick(), 8); }
  tick() { const now = performance.now(); for (const [id, r] of this.rooms) if (!r.update(now)) { r.closed = true; for (const c of r.clients) c?.ws.close(1000); this.rooms.delete(id); } }
  stop() { clearInterval(this.timer); for (const r of this.rooms.values()) for (const c of r.clients) c?.ws.close(1001); this.rooms.clear(); }
  stats() { let players = 0; for (const r of this.rooms.values()) players += r.count; return { rooms: this.rooms.size, players }; }
  private findRoom(code: string | undefined, arena: string): Room | null {
    if (code) { const r = this.rooms.get(code); return r?.joinable ? r : null; }
    for (const r of this.rooms.values()) if (r.joinable && r.arenaId === arena && r.id.startsWith('p-')) return r; // public quick-join
    return null;
  }
  handle(ws: Socket) {
    let client: Client | null = null; const send = (m: object) => ws.readyState === 1 && ws.send(JSON.stringify(m));
    ws.on('message', (data: any, isBinary: boolean) => {
      try {
        if (isBinary) { if (!client) return; const b = data instanceof Uint8Array ? data : new Uint8Array(data); if (b[0] !== MSG_INPUT) return;
          const t = { ...client.input }; const seq = decodeInput(b, t); if (seq === null) return;
          if (seq < client.seq && client.seq - seq < 1 << 30) return; // stale
          client.dash ||= t.dash; client.ability ||= t.ability; t.dash = t.ability = false;
          const n = Math.hypot(t.aimX, t.aimZ); if (n > 0) { t.aimX /= n; t.aimZ /= n; } else { t.aimX = client.input.aimX; t.aimZ = client.input.aimZ; }
          client.input = t; client.seq = seq; client.lastInput = performance.now(); return; }
        const m = JSON.parse(data.toString());
        if (m.t === 'join' && !client) {
          const arena = typeof m.arena === 'string' ? m.arena : this.opts.arena ?? 'ashen_woods';
          const code = typeof m.room === 'string' && /^[A-Za-z0-9_-]{1,16}$/.test(m.room) ? m.room : undefined;
          let room = this.findRoom(code, arena);
          if (!room) { const id = code ?? 'p-' + Math.random().toString(36).slice(2, 7); if (this.rooms.has(id)) return send({ t: 'error', msg: 'room full' });
            room = new Room(id, (this.opts.seed?.() ?? Math.floor(Math.random() * 0xffffff)) >>> 0, arena); this.rooms.set(id, room); }
          client = room.add(ws); if (!client) return send({ t: 'error', msg: 'room full' });
          send({ t: 'welcome', v: PROTO_VERSION, slot: client.slot, room: room.id, seed: room.seed, arena: room.arenaId, tick: room.sim.state.tick, tickRate: TICK_RATE, snapHz: SNAPSHOT_HZ });
          room.broadcastText({ t: 'peer', slot: client.slot, joined: true, count: room.count }, client);
        } else if (m.t === 'choose' && client && typeof m.i === 'number') {
          if (client.room.sim.state.phase === 'levelUp') client.room.sim.choose(m.i | 0); // TODO per-player
        } else if (m.t === 'ping') send({ t: 'pong', c: m.c, s: performance.now() });
      } catch { /* ignore malformed */ }
    });
    const leave = () => { if (client) { const r = client.room; r.remove(client); r.broadcastText({ t: 'peer', slot: client.slot, joined: false, count: r.count }); client = null; } };
    ws.on('close', leave); ws.on('error', leave);
  }
}
