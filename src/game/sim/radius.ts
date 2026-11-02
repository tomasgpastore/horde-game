import type { SimState } from '@shared/types';
import { enemyDef, BOSS_KIND } from './content/enemies';
/** Boss hitboxes ≈ 0.8× the visual model radius (Stag/Warden model ≈2.2, Unlit ≈2.9 incl. its 1.3× scale) so hits feel fair. */
export const BOSS_HIT_RADIUS: Record<string, number> = { hollow_stag: 1.76, bell_warden: 1.76, the_unlit: 2.3 };
export function enemyRadius(s: SimState, j: number): number {
  const e = s.enemies; if (e.kind[j] === BOSS_KIND && s.boss && s.boss.idx === j) return BOSS_HIT_RADIUS[s.boss.id] ?? 1.76;
  return enemyDef(e.kind[j]).radius;
}
