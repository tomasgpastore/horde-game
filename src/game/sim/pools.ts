import { EnemyPool, ProjectilePool, PickupPool, MAX_ENEMIES, MAX_PROJECTILES, MAX_PICKUPS } from '@shared/types';
const f = (n: number) => new Float32Array(n), u = (n: number) => new Uint8Array(n);
export const makeEnemies = (n = MAX_ENEMIES): EnemyPool => ({ count: 0, alive: u(n), kind: u(n), x: f(n), z: f(n), vx: f(n), vz: f(n), hp: f(n), hitFlash: f(n), facing: f(n), slow: f(n), aux: f(n), elite: u(n) });
export const makeProjectiles = (n = MAX_PROJECTILES): ProjectilePool => ({ count: 0, alive: u(n), kind: u(n), owner: u(n), x: f(n), z: f(n), vx: f(n), vz: f(n), life: f(n), dmg: f(n), pierce: u(n), aux: f(n), hits: new Int32Array(n * 4), hitN: u(n) });
export const makePickups = (n = MAX_PICKUPS): PickupPool => ({ count: 0, alive: u(n), kind: u(n), x: f(n), z: f(n), value: f(n), magnet: u(n) });
/** Find free slot (linear from hint). Returns -1 when full. */
export function alloc(alive: Uint8Array, count: number, cap: number): number {
  for (let i = 0; i < count; i++) if (!alive[i]) return i;
  return count < cap ? count : -1;
}
