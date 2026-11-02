import { SimState, PlayerInput, ArenaDef, EMPTY_INPUT, TICK_DT, MAX_PLAYERS } from '@shared/types';
import { Rng } from '@shared/rng';
import { makeEnemies, makeProjectiles, makePickups } from './pools';
import type { System } from './system';
import { playerSystem } from './systems/player';
import { enemySystem } from './systems/enemies';
import { spawner } from './systems/spawner';
import { arenaCollision } from './systems/arenaCollision';

export function createState(seed: number, arena: ArenaDef, playerCount = 1): SimState {
  const players = Array.from({ length: MAX_PLAYERS }, (_, id) => {
    const sp = arena.playerSpawn[id % arena.playerSpawn.length];
    return { id, active: id < playerCount, x: sp.x, z: sp.z, vx: 0, vz: 0, facing: 0, hp: 100, maxHp: 100, level: 1, xp: 0, xpToNext: 5,
      dashTime: 0, dashCooldown: 0, iframes: 0, weapons: [{ id: 'ember_bolt', level: 1, cooldown: 0 }],
      stats: { moveSpeed: 6, damageMult: 1, area: 1, pickupRadius: 2.5, cooldownMult: 1 }, dead: false };
  });
  return { tick: 0, time: 0, seed, players, enemies: makeEnemies(), projectiles: makeProjectiles(), pickups: makePickups(),
    events: [], phase: 'running', wave: 0, kills: 0, gold: 0 };
}

/** Deterministic fixed-step simulation. Same (seed, input stream) => same state. Runs in browser now, Node server later. */
export class Sim {
  rng: Rng; systems: System[] = [spawner, playerSystem, enemySystem, arenaCollision];
  constructor(public state: SimState, public arena: ArenaDef) { this.rng = new Rng(state.seed); }
  register(sys: System, before?: string) {
    const i = before ? this.systems.findIndex(s => s.name === before) : -1;
    if (i >= 0) this.systems.splice(i, 0, sys); else this.systems.push(sys);
  }
  step(inputs: PlayerInput[]) {
    const s = this.state; s.events.length = 0;
    if (s.phase === 'running') {
      const ctx = { dt: TICK_DT, rng: this.rng, arena: this.arena, inputs: inputs.length ? inputs : [EMPTY_INPUT] };
      for (const sys of this.systems) sys.update(s, ctx);
      s.time += TICK_DT;
    }
    s.tick++;
  }
}
