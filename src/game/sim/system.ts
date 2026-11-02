import type { SimState, PlayerInput, ArenaDef } from '@shared/types';
import type { Rng } from '@shared/rng';
/** Every gameplay feature is a System: a pure function over SimState. Register in sim/index.ts in order.
 *  Gameplay Engineer owns player/weapons/enemies/xp systems. World Engineer owns spawner+arena collision hooks. */
export interface SimCtx { dt: number; rng: Rng; arena: ArenaDef; inputs: PlayerInput[] }
export interface System { name: string; update(s: SimState, c: SimCtx): void }
