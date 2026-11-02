import type { SimState } from '@shared/types';
import { enemyDef, BOSS_KIND } from './content/enemies';
/** Boss hitboxes ≈ 0.8× the visual model radius (model radii now Stag 3.1 / Warden 2.9 / Unlit 3.4 (after Art #130 scaling)) so hits feel fair. */
export const BOSS_HIT_RADIUS: Record<string, number> = { hollow_stag: 2.5, bell_warden: 2.3, the_unlit: 2.7 };
export function enemyRadius(s: SimState, j: number): number {
  const e = s.enemies; if (e.kind[j] === BOSS_KIND && s.boss && s.boss.idx === j) return BOSS_HIT_RADIUS[s.boss.id] ?? 1.76;
  return enemyDef(e.kind[j]).radius;
}
