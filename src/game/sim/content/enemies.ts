/** Enemy kind table (index = EnemyPool.kind). Gameplay Engineer owns; GDD roster to be filled in. */
export interface EnemyDef { id: string; hp: number; speed: number; dmg: number; xp: number; radius: number }
export const ENEMIES: EnemyDef[] = [
  { id: 'husk', hp: 6, speed: 2.3, dmg: 6, xp: 1, radius: 0.45 },
  { id: 'wisp', hp: 14, speed: 3.4, dmg: 4, xp: 1, radius: 0.35 },
  { id: 'brute', hp: 40, speed: 1.7, dmg: 14, xp: 3, radius: 0.7 },
  { id: 'skitter', hp: 4, speed: 5.2, dmg: 3, xp: 1, radius: 0.3 },
  { id: 'bloater', hp: 70, speed: 1.2, dmg: 18, xp: 5, radius: 0.95 },
  { id: 'shield_knight', hp: 55, speed: 1.9, dmg: 12, xp: 4, radius: 0.6 },
  { id: 'spitter', hp: 16, speed: 2.0, dmg: 6, xp: 2, radius: 0.45 },   // TODO ranged attack (Gameplay)
  { id: 'wraith', hp: 26, speed: 3.0, dmg: 9, xp: 3, radius: 0.5 },    // TODO phases through obstacles
  { id: 'boss', hp: 1, speed: 0, dmg: 25, xp: 40, radius: 1.5 }, // kind 8: stats driven by BOSSES table; movement by systems/boss.ts
];
export const BOSS_KIND = 8;
/** hp/speed/charge per boss id (GDD: Hollow Stag min5, Bell-Warden min10, The Unlit min15). */
export const BOSSES: Record<string, { name: string; hp: number; speed: number; charge: number; windup: number; cd: number }> = {
  hollow_stag: { name: 'The Hollow Stag', hp: 900, speed: 2.6, charge: 17, windup: 0.9, cd: 3.2 },
  bell_warden: { name: 'The Bell-Warden', hp: 2400, speed: 2.9, charge: 19, windup: 0.8, cd: 2.8 },
  the_unlit: { name: 'The Unlit', hp: 6000, speed: 3.3, charge: 22, windup: 0.7, cd: 2.4 },
};
/** Boss phases by remaining-hp fraction (first entry whose hpBelow >= current fraction, scanning from the last). speed/cd multipliers, radial shot burst after each charge, periodic summons. */
export interface BossPhaseDef { hpBelow: number; speedMult: number; cdMult: number; burst?: { count: number; speed: number; dmg: number; life: number }; summon?: { kind: number; count: number; everyS: number } }
export const BOSS_PHASES: Record<string, BossPhaseDef[]> = {
  hollow_stag: [ // charge lines + radial antler bursts
    { hpBelow: 1.0, speedMult: 1, cdMult: 1 },
    { hpBelow: 0.66, speedMult: 1.1, cdMult: 0.85, burst: { count: 10, speed: 7, dmg: 10, life: 2.4 } },
    { hpBelow: 0.33, speedMult: 1.25, cdMult: 0.7, burst: { count: 16, speed: 8, dmg: 12, life: 2.6 } },
  ],
  bell_warden: [ // slam shockwave rings + summons Wraiths
    { hpBelow: 1.0, speedMult: 1, cdMult: 1, burst: { count: 12, speed: 6, dmg: 10, life: 2.2 } },
    { hpBelow: 0.66, speedMult: 1.1, cdMult: 0.85, burst: { count: 18, speed: 7, dmg: 12, life: 2.4 }, summon: { kind: 7, count: 3, everyS: 14 } },
    { hpBelow: 0.33, speedMult: 1.2, cdMult: 0.7, burst: { count: 24, speed: 8, dmg: 14, life: 2.6 }, summon: { kind: 7, count: 5, everyS: 10 } },
  ],
  the_unlit: [ // multi-phase, enrages
    { hpBelow: 1.0, speedMult: 1, cdMult: 1, burst: { count: 12, speed: 7, dmg: 12, life: 2.4 } },
    { hpBelow: 0.66, speedMult: 1.1, cdMult: 0.8, burst: { count: 20, speed: 8, dmg: 14, life: 2.6 }, summon: { kind: 7, count: 4, everyS: 12 } },
    { hpBelow: 0.33, speedMult: 1.3, cdMult: 0.6, burst: { count: 28, speed: 9, dmg: 16, life: 2.8 }, summon: { kind: 6, count: 3, everyS: 9 } },
  ],
};
export function bossPhase(id: string, frac: number): BossPhaseDef { const ph = BOSS_PHASES[id]; let r = ph[0]; for (const p of ph) if (frac <= p.hpBelow) r = p; return r; }
export const enemyDef = (kind: number) => ENEMIES[kind] ?? ENEMIES[0];
