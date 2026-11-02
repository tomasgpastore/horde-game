/**
 * EMBERHORDE — balance & design data (Game Designer). Pure data + tiny helpers, no deps.
 * Units: seconds, world units (1 unit ≈ player body height ×0.55; player is ~1.8u tall), HP/damage as numbers.
 * All "pct" fields are fractions (0.10 = +10%). Player base stats live in PLAYER.
 * Tuning knobs are meant to be edited; keep ids stable.
 */

// ───────────────────────── PLAYER ─────────────────────────
export const PLAYER = {
  maxHp: 100,
  moveSpeed: 6.0,          // u/s
  pickupRadius: 2.5,       // xp gem magnet radius
  hpRegen: 0,              // /s
  iFrames: 0.5,            // s after contact hit
  contactTickInterval: 0.5,// enemies deal contact dmg at most this often per enemy
  dashEnabled: false,      // v1: no dash; optional Space = "Ember Burst" (see ABILITY)
  startingWeapon: 'ember_bolt',
  levelUpHeal: 0,
  critChance: 0.05,
  critMult: 2.0,
} as const;

// optional active, big power-fantasy button; cooldown refunds on boss kills
export const ABILITY = { id: 'ember_burst', key: 'Space', cooldown: 25, radius: 9, damage: 60, knockback: 8, clearsEnemyProjectiles: true } as const;

// ───────────────────────── PASSIVES ─────────────────────────
// Each level adds `perLevel` to the stat. maxLevel 5.
export type PassiveId = 'might' | 'haste' | 'vitality' | 'swiftness' | 'magnet' | 'fortune' | 'growth' | 'bulwark';
export const PASSIVES: Record<PassiveId, { name: string; stat: string; perLevel: number; maxLevel: number; desc: string }> = {
  might:     { name: 'Cinder Heart',  stat: 'damageMult',     perLevel: 0.12, maxLevel: 5, desc: '+12% damage per level' },
  haste:     { name: 'Quickspark',    stat: 'cooldownMult',   perLevel: -0.08, maxLevel: 5, desc: '-8% weapon cooldown per level (floor 0.4x)' },
  vitality:  { name: 'Hearthstone',   stat: 'maxHpAdd',       perLevel: 20,   maxLevel: 5, desc: '+20 max HP and +0.3 regen/s per level' },
  swiftness: { name: 'Windstep',      stat: 'moveSpeedMult',  perLevel: 0.07, maxLevel: 5, desc: '+7% move speed per level' },
  magnet:    { name: 'Lodestone',     stat: 'pickupRadiusMult', perLevel: 0.30, maxLevel: 5, desc: '+30% pickup radius per level' },
  fortune:   { name: 'Clover Ash',    stat: 'luck',           perLevel: 0.10, maxLevel: 5, desc: '+10% luck/level (rarer cards, gold, crits +2%)' },
  growth:    { name: 'Scholar Ember', stat: 'xpMult',         perLevel: 0.10, maxLevel: 5, desc: '+10% XP gained per level' },
  bulwark:   { name: 'Ironbark',      stat: 'armor',          perLevel: 1,    maxLevel: 5, desc: '-1 flat damage per hit per level (min 1), +4% area/level' },
};
export const VITALITY_REGEN_PER_LEVEL = 0.3;
export const BULWARK_AREA_PER_LEVEL = 0.04;
export const HASTE_MIN_COOLDOWN_MULT = 0.4;
export const MAX_WEAPON_SLOTS = 6;
export const MAX_PASSIVE_SLOTS = 6;

// ───────────────────────── WEAPONS ─────────────────────────
/**
 * Per-level arrays are index 0..5 for lvl1..lvl6.
 * dmg = per-hit damage before multipliers. cd = seconds between volleys.
 * Common fields: count (projectiles/blades/targets), speed, radius (hit radius or AoE), pierce, duration.
 * Upgrade card text can be auto-generated from deltas between levels.
 */
export interface WeaponDef {
  id: string; name: string; kind: 'projectile' | 'orbit' | 'nova' | 'chain' | 'trail' | 'homing';
  desc: string; passive: PassiveId; evolution: string;
  dmg: number[]; cd: number[]; count: number[];
  speed?: number[]; radius?: number[]; pierce?: number[]; duration?: number[];
  extra?: Record<string, number[]>;
}

export const WEAPONS: Record<string, WeaponDef> = {
  ember_bolt: {
    id: 'ember_bolt', name: 'Ember Bolt', kind: 'projectile', passive: 'might', evolution: 'sunfire_barrage',
    desc: 'Fires fiery bolts at the nearest enemy.',
    dmg:    [10, 12, 14, 17, 20, 26],
    cd:     [0.80, 0.75, 0.70, 0.65, 0.58, 0.50],
    count:  [1, 1, 2, 2, 3, 4],
    speed:  [16, 16, 17, 17, 18, 20],
    radius: [0.35, 0.35, 0.4, 0.4, 0.45, 0.5],
    pierce: [0, 1, 1, 2, 2, 4],
    duration: [1.5, 1.5, 1.6, 1.6, 1.8, 2.0],
    extra: { spreadDeg: [0, 0, 8, 8, 10, 12], burnDps: [0, 0, 0, 3, 4, 6] },
  },
  orbit_blades: {
    id: 'orbit_blades', name: 'Orbit Blades', kind: 'orbit', passive: 'swiftness', evolution: 'bladestorm_halo',
    desc: 'Spectral blades orbit you, shredding anything close.',
    dmg:    [7, 8, 9, 11, 13, 17],
    cd:     [3.0, 2.8, 2.6, 2.4, 2.2, 2.0],      // downtime between orbit cycles
    count:  [2, 2, 3, 3, 4, 5],
    speed:  [180, 190, 200, 210, 225, 250],      // deg/s
    radius: [2.4, 2.5, 2.6, 2.8, 3.0, 3.4],      // orbit radius
    duration: [3.0, 3.2, 3.4, 3.6, 4.0, 4.5],    // active time per cycle
    extra: { hitInterval: [0.45, 0.4, 0.4, 0.35, 0.3, 0.25], knockback: [1, 1, 1.5, 1.5, 2, 2.5] },
  },
  frost_nova: {
    id: 'frost_nova', name: 'Frost Nova', kind: 'nova', passive: 'bulwark', evolution: 'absolute_zero',
    desc: 'Periodic freezing pulse around you. Slows and chills.',
    dmg:    [14, 17, 20, 24, 29, 38],
    cd:     [4.0, 3.8, 3.5, 3.2, 2.9, 2.5],
    count:  [1, 1, 1, 1, 2, 2],                   // pulses per cast (0.3s apart)
    radius: [4.5, 5.0, 5.5, 6.0, 6.8, 8.0],
    duration: [1.5, 1.7, 1.9, 2.1, 2.4, 3.0],     // slow duration
    extra: { slowPct: [0.35, 0.4, 0.45, 0.5, 0.55, 0.65], freezeChance: [0, 0, 0.1, 0.15, 0.2, 0.3], freezeTime: [0, 0, 0.8, 1.0, 1.2, 1.5] },
  },
  chain_lightning: {
    id: 'chain_lightning', name: 'Chain Lightning', kind: 'chain', passive: 'haste', evolution: 'tempest_crown',
    desc: 'Lightning arcs between nearby enemies.',
    dmg:    [16, 19, 22, 26, 31, 40],
    cd:     [1.6, 1.5, 1.4, 1.25, 1.1, 0.9],
    count:  [3, 4, 5, 6, 8, 10],                  // total jumps (targets)
    radius: [5, 5.5, 6, 6.5, 7, 8],               // jump range
    extra: { strikes: [1, 1, 1, 2, 2, 3], dmgFalloff: [0.9, 0.9, 0.92, 0.92, 0.95, 1.0], stunChance: [0, 0, 0.1, 0.1, 0.15, 0.25] },
  },
  lava_trail: {
    id: 'lava_trail', name: 'Lava Trail', kind: 'trail', passive: 'vitality', evolution: 'magma_wake',
    desc: 'Leave burning lava pools behind as you move.',
    dmg:    [5, 6, 7, 9, 11, 15],                 // per tick
    cd:     [0.45, 0.42, 0.40, 0.36, 0.32, 0.28], // drop interval while moving
    count:  [1, 1, 1, 1, 1, 2],                   // pools per drop
    radius: [1.2, 1.3, 1.4, 1.6, 1.8, 2.2],
    duration: [2.5, 3.0, 3.5, 4.0, 4.5, 5.5],     // pool lifetime
    extra: { tickInterval: [0.4, 0.4, 0.35, 0.35, 0.3, 0.25], slowPct: [0, 0, 0.1, 0.15, 0.2, 0.3] },
  },
  seeker_spears: {
    id: 'seeker_spears', name: 'Seeker Spears', kind: 'homing', passive: 'fortune', evolution: 'fate_lances',
    desc: 'Spears that hunt down enemies, favoring the strongest.',
    dmg:    [18, 21, 25, 29, 34, 44],
    cd:     [2.2, 2.0, 1.9, 1.7, 1.5, 1.2],
    count:  [2, 2, 3, 4, 5, 7],
    speed:  [12, 13, 14, 15, 16, 18],
    radius: [0.4, 0.4, 0.45, 0.45, 0.5, 0.55],
    pierce: [0, 0, 1, 1, 2, 3],
    duration: [3, 3, 3.2, 3.5, 3.8, 4.5],
    extra: { turnRateDegPerSec: [180, 200, 220, 240, 270, 320], critBonus: [0, 0, 0.05, 0.05, 0.1, 0.2] },
  },
};

/** Evolutions: require weapon level 6 + owning the paired passive (any level ≥1). Granted by BOSS CHEST (min 5/10/15 bosses) — chest opens evolve screen. */
export const EVOLUTIONS: Record<string, { name: string; base: string; passive: PassiveId; desc: string; dmgMult: number; cdMult: number; countAdd: number; radiusMult: number; special: string }> = {
  sunfire_barrage: { name: 'Sunfire Barrage', base: 'ember_bolt',      passive: 'might',     desc: 'Bolts become exploding suns; fires a 360° ring every 4th volley.', dmgMult: 1.6, cdMult: 0.8, countAdd: 2, radiusMult: 1.5, special: 'explode r=2.5 for 60% dmg; ring of 12 every 4th volley; pierce=infinite' },
  bladestorm_halo: { name: 'Bladestorm Halo', base: 'orbit_blades',    passive: 'swiftness', desc: 'Two counter-rotating rings, permanent; blades fly out at enemies.', dmgMult: 1.5, cdMult: 0.0, countAdd: 4, radiusMult: 1.3, special: 'no downtime; second ring r=5 reverse; every 5s launch 4 blades outward' },
  absolute_zero:   { name: 'Absolute Zero',   base: 'frost_nova',      passive: 'bulwark',   desc: 'Continuous freezing aura; frozen enemies shatter for bonus damage.', dmgMult: 1.4, cdMult: 0.6, countAdd: 1, radiusMult: 1.4, special: 'permanent aura r=7 slows 50%; frozen enemies take +100% dmg; shatter kills deal 30 AoE' },
  tempest_crown:   { name: 'Tempest Crown',   base: 'chain_lightning', passive: 'haste',     desc: 'Storm cloud follows you; lightning strikes random enemies on screen.', dmgMult: 1.5, cdMult: 0.5, countAdd: 6, radiusMult: 1.5, special: 'chain also bounces back to previous targets; extra 3 random strikes/s on screen' },
  magma_wake:      { name: 'Magma Wake',      base: 'lava_trail',      passive: 'vitality',  desc: 'Wide molten river; standing in it heals you.', dmgMult: 1.6, cdMult: 0.7, countAdd: 1, radiusMult: 1.6, special: 'pools heal player 1 HP/s inside; enemy kills in lava spawn fire pools' },
  fate_lances:     { name: 'Fate Lances',     base: 'seeker_spears',   passive: 'fortune',   desc: 'Lances always crit-seek elites and bosses; kills drop extra gold.', dmgMult: 1.5, cdMult: 0.7, countAdd: 5, radiusMult: 1.2, special: 'infinite pierce; first hit on elite/boss always crits; 10% kill chance for +gold' },
};

// ───────────────────────── ENEMIES ─────────────────────────
/**
 * baseHp/dmg/speed at t=0. Effective values = base * scaling (see ENEMY_SCALING).
 * dmg = contact dmg per hit (or projectile dmg for ranged). xp = base gem value.
 * size = visual/hitbox radius.
 */
export interface EnemyDef {
  id: string; name: string; hp: number; speed: number; dmg: number; xp: number; radius: number;
  behavior: string; goldChance: number; knockbackResist: number; threat: number; // threat = spawn budget cost
  ranged?: { range: number; cd: number; projSpeed: number };
  onDeath?: string; special?: string;
}
export const ENEMIES: Record<string, EnemyDef> = {
  husk:     { id: 'husk',     name: 'Husk',        hp: 16,  speed: 2.6, dmg: 6,  xp: 1,  radius: 0.5, behavior: 'chase', goldChance: 0.01, knockbackResist: 0,   threat: 1 },
  wisp:     { id: 'wisp',     name: 'Wisp',        hp: 9,   speed: 4.2, dmg: 5,  xp: 1,  radius: 0.4, behavior: 'chase_wavy (sine ±1.5u, flies over lava)', goldChance: 0.01, knockbackResist: 0, threat: 1 },
  brute:    { id: 'brute',    name: 'Brute',       hp: 120, speed: 2.0, dmg: 18, xp: 6,  radius: 0.9, behavior: 'chase; telegraphs lunge every 4s (0.5s windup, 3x speed 0.6s)', goldChance: 0.05, knockbackResist: 0.7, threat: 8 },
  spitter:  { id: 'spitter', name: 'Spitter',     hp: 30,  speed: 2.2, dmg: 8,  xp: 3,  radius: 0.5, behavior: 'keep distance 9u, shoot', goldChance: 0.03, knockbackResist: 0.2, threat: 4, ranged: { range: 10, cd: 2.5, projSpeed: 7 } },
  bloater:  { id: 'bloater',  name: 'Bloater',     hp: 70,  speed: 1.7, dmg: 10, xp: 4,  radius: 0.8, behavior: 'chase', goldChance: 0.03, knockbackResist: 0.5, threat: 5, onDeath: 'explodes: r=3.5, 20 dmg to player after 0.8s telegraph; also damages nearby enemies 40' },
  skitter:  { id: 'skitter',  name: 'Skitter',     hp: 6,   speed: 5.5, dmg: 4,  xp: 1,  radius: 0.3, behavior: 'swarm; spawns in packs of 10-20, circles then rushes', goldChance: 0, knockbackResist: 0, threat: 0.5 },
  wraith:   { id: 'wraith',   name: 'Wraith',      hp: 55,  speed: 3.4, dmg: 14, xp: 5,  radius: 0.6, behavior: 'phases (immune, no collision) 1s every 4s while approaching; solid when adjacent', goldChance: 0.04, knockbackResist: 0.3, threat: 6 },
  shield_knight: { id: 'shield_knight', name: 'Shield Knight', hp: 200, speed: 2.4, dmg: 20, xp: 12, radius: 0.9, behavior: 'chase; front shield blocks 80% dmg from front 120° arc; flanking/lava/orbit hits at full', goldChance: 0.10, knockbackResist: 0.8, threat: 14, special: 'frontBlock=0.8,arcDeg=120' },
};

/** Effective stat = base * f(t), t in minutes. Elites (see ELITES) are extra. */
export const ENEMY_SCALING = {
  hpMult:  (m: number) => 1 + 0.22 * m + 0.012 * m * m,   // m=15 -> ~6.0x
  dmgMult: (m: number) => 1 + 0.06 * m,                    // m=15 -> 1.9x
  speedMult: (m: number) => Math.min(1.35, 1 + 0.025 * m), // soft cap
  xpMult:  (m: number) => 1 + 0.08 * m,
};
export const ELITES = {
  spawnEveryS: 45, startMin: 2, hpMult: 6, dmgMult: 1.4, sizeMult: 1.4, xpMult: 8,
  drops: ['gold_pile:25', 'heal_orb', 'chest_small'], // chest_small = free passive/weapon level
  glowColor: '#ffcc33',
};

// ───────────────────────── SPAWN DIRECTOR ─────────────────────────
/**
 * Time-segmented director. For each segment: spawn `perSec` enemies/s (spread over ring 14-18u from player, outside view),
 * never exceeding `cap` alive (hard performance cap 450; despawn+respawn far stragglers >30u).
 * `mix` = weights. Packs/events layered on top. Ramp targets ~60 alive at 1m, ~150 at 5m, ~280 at 10m, ~400 at 15m.
 * Player power curve target: kills/sec ≈ spawn rate by design (steady-state), so alive stays near cap-ish only at spikes.
 */
export interface Segment { fromS: number; toS: number; perSec: number; cap: number; mix: Record<string, number>; }
export const SPAWN_SEGMENTS: Segment[] = [
  { fromS: 0,   toS: 30,  perSec: 1.2, cap: 18,  mix: { husk: 10 } },                                        // gentle: first gem at ~8s, lvl2 by ~15s
  { fromS: 30,  toS: 60,  perSec: 2.2, cap: 40,  mix: { husk: 8, wisp: 3 } },
  { fromS: 60,  toS: 120, perSec: 3.5, cap: 70,  mix: { husk: 8, wisp: 4, spitter: 1 } },
  { fromS: 120, toS: 180, perSec: 5,   cap: 100, mix: { husk: 8, wisp: 4, spitter: 2, brute: 1 } },
  { fromS: 180, toS: 240, perSec: 6.5, cap: 130, mix: { husk: 7, wisp: 4, spitter: 2, brute: 1.5, skitter: 2 } },
  { fromS: 240, toS: 300, perSec: 8,   cap: 150, mix: { husk: 7, wisp: 4, spitter: 2, brute: 2, bloater: 1.5, skitter: 2 } },
  // 5:00 boss 1 (Cinder Colossus): spawns pause 20s (perSec x0.3) during intro
  { fromS: 300, toS: 360, perSec: 9,   cap: 180, mix: { husk: 6, wisp: 4, spitter: 2, brute: 2, bloater: 2, skitter: 3, wraith: 1 } },
  { fromS: 360, toS: 480, perSec: 11,  cap: 220, mix: { husk: 5, wisp: 4, spitter: 2, brute: 2, bloater: 2, skitter: 3, wraith: 2, shield_knight: 1 } },
  { fromS: 480, toS: 600, perSec: 13,  cap: 280, mix: { husk: 5, wisp: 4, spitter: 3, brute: 2, bloater: 2, skitter: 3, wraith: 3, shield_knight: 1.5 } },
  // 10:00 boss 2 (Hollow Queen)
  { fromS: 600, toS: 720, perSec: 15,  cap: 330, mix: { husk: 5, wisp: 4, spitter: 3, brute: 2.5, bloater: 2.5, skitter: 4, wraith: 3, shield_knight: 2 } },
  { fromS: 720, toS: 840, perSec: 17,  cap: 370, mix: { husk: 4, wisp: 4, spitter: 3, brute: 3, bloater: 3, skitter: 4, wraith: 4, shield_knight: 3 } },
  { fromS: 840, toS: 900, perSec: 20,  cap: 420, mix: { husk: 4, wisp: 4, spitter: 3, brute: 3, bloater: 3, skitter: 5, wraith: 4, shield_knight: 3 } },
  // 15:00 boss 3 (The Emberlord) — final; after kill: victory OR "Endless" with segment 840+ scaling x1.1 per minute
];
export const HARD_ALIVE_CAP = 450;

/** One-off events layered on the director. kind: 'pack' (cluster at angle), 'ring' (encircle player), 'wall' (line sweep). */
export const SPAWN_EVENTS: { atS: number; kind: 'pack' | 'ring' | 'wall'; enemy: string; count: number; note: string }[] = [
  { atS: 20,  kind: 'pack', enemy: 'husk',    count: 12,  note: 'first power-fantasy moment: clump to mow down' },
  { atS: 75,  kind: 'pack', enemy: 'wisp',    count: 15,  note: 'speed lesson' },
  { atS: 150, kind: 'ring', enemy: 'husk',    count: 40,  note: 'encirclement — teaches Nova/orbit value' },
  { atS: 200, kind: 'pack', enemy: 'skitter', count: 30,  note: 'swarm' },
  { atS: 270, kind: 'wall', enemy: 'husk',    count: 50,  note: 'pre-boss crunch' },
  { atS: 420, kind: 'ring', enemy: 'skitter', count: 80,  note: 'big ring' },
  { atS: 520, kind: 'wall', enemy: 'shield_knight', count: 6, note: 'phalanx' },
  { atS: 660, kind: 'ring', enemy: 'wraith',  count: 24,  note: 'ghost ring' },
  { atS: 780, kind: 'ring', enemy: 'husk',    count: 120, note: 'mega ring — screen-clear fantasy' },
  { atS: 850, kind: 'wall', enemy: 'bloater', count: 12,  note: 'chain explosion fun' },
];

// ───────────────────────── XP / LEVELING ─────────────────────────
/**
 * Gem tiers: small 1, medium 5, large 25, huge 100 (xp * xpMult(growth, time scaling)).
 * xpToNext(L) = XP needed to go from level L to L+1. L1->L2 = 5 → with ~1.2 husk/s and xp 1 each plus first pack at 20s: ~15s.
 */
export const XP_GEMS = { small: 1, medium: 5, large: 25, huge: 100 };
export function xpToNext(L: number): number {
  if (L <= 1) return 5;
  if (L <= 10) return Math.round(5 + (L - 1) * 5.5 + Math.pow(L - 1, 1.5));    // L2->3 ~11, L10->11 ~ 82
  return Math.round(82 + (L - 10) * 14 + Math.pow(L - 10, 1.7));               // L20->21 ~ 275
}
/** Target pacing (build decision every ~40s): lvl2 @0:15, lvl5 @1:10, lvl10 @3:00, lvl20 @8:00, lvl30 @13:00 for a competent player. Tune via XP_GEMS or xpToNext. */
export const LEVEL_PACING_TARGETS = [{ level: 2, atS: 15 }, { level: 5, atS: 70 }, { level: 10, atS: 180 }, { level: 20, atS: 480 }, { level: 30, atS: 780 }];
export const LEVEL_UP_HEAL_PCT = 0.0; // set 0.1 if too punishing in playtest
export const MAGNET_PICKUP_BOMB = { spawnEveryS: 120, desc: 'Rare drop vacuums every gem on map' };

// ───────────────────────── LEVEL-UP CARDS ─────────────────────────
export const CARD_RULES = {
  choices: 3,                    // base cards shown
  extraChoiceAtLuck: 0.5,        // luck ≥ 0.5 -> 4 cards
  baseRerolls: 1,                // per run
  baseBanishes: 1,               // per run (remove card from pool forever)
  skips: 'unlimited, gives +25 gold (or heals 15% HP if gold-capped)',
  // Card type weights. If weapon slots full, weapon-new weight = 0; passive likewise. Maxed items removed.
  typeWeights: { weapon_new: 3, weapon_upgrade: 5, passive_new: 3, passive_upgrade: 4 },
  // Guarantees:
  guarantees: [
    'Level 2,3: at least one NEW weapon among cards (until 3 weapons owned)',
    'First 5 level-ups: at least 1 card is an upgrade to an owned weapon',
    'If an owned weapon is lvl6 and its evolution passive not owned: that passive is weighted x3',
    'Never offer all 3 cards of the same type; never offer an item twice in a row (unless pool < 3)',
    'Pity: after 4 level-ups without evolution-relevant card, weight x2 on one',
  ],
  // Rarity ("tier") of stat boosts on cards, affected by luck: roll value multiplier.
  rarity: [
    { id: 'common', weight: 100, statMult: 1.0,  color: '#cfd8dc' },
    { id: 'rare',   weight: 22,  statMult: 1.5,  color: '#4fc3f7' },
    { id: 'epic',   weight: 6,   statMult: 2.0,  color: '#ba68c8' },
  ],
  luckRarityBonus: 'rare & epic weights multiplied by (1 + 2*luck)',
  // Bonus "gold cards" appear 1 per 8 level-ups: +50 gold or heal full — free choice slot, no pick cost
  rerollsFromLuck: 'every +0.25 luck grants +1 reroll',
  evolutionCard: 'Evolution only via boss chest (guaranteed on boss kill if requirement met); otherwise chest gives 3 free upgrades',
};

// ───────────────────────── BOSSES ─────────────────────────
export interface BossPhase { hpBelow: number; patterns: string[]; speedMult?: number; spawn?: { enemy: string; count: number; everyS: number } }
export const BOSSES: Record<string, { name: string; atS: number; hp: number; speed: number; dmgContact: number; radius: number; xp: number; gold: number; arena?: string; phases: BossPhase[]; chest: string; patterns: Record<string, string> }> = {
  cinder_colossus: {
    name: 'Cinder Colossus', atS: 300, hp: 5000, speed: 1.8, dmgContact: 25, radius: 2.2, xp: 150, gold: 100, chest: 'evolution_or_3_upgrades',
    patterns: {
      slam:   'telegraph circle r=5 under player for 1.0s, 45 dmg; stuns enemies; leaves lava 4s',
      stomp_wave: 'expanding ring from boss, speed 8, 30 dmg, jump over via... none (just dash through gap 2u)',
      ember_rain: '8 meteors random near player, 1.2s warning r=2.5, 35 dmg',
    },
    phases: [
      { hpBelow: 1.0, patterns: ['slam'] },
      { hpBelow: 0.6, patterns: ['slam', 'ember_rain'], speedMult: 1.2 },
      { hpBelow: 0.3, patterns: ['slam', 'ember_rain', 'stomp_wave'], speedMult: 1.4, spawn: { enemy: 'husk', count: 10, everyS: 8 } },
    ],
  },
  hollow_queen: {
    name: 'Hollow Queen', atS: 600, hp: 20000, speed: 3.0, dmgContact: 30, radius: 1.5, xp: 400, gold: 200, chest: 'evolution_or_3_upgrades',
    patterns: {
      spiral_bullets: '3 arms x 12 shots, rotating, speed 6, 15 dmg',
      blink_strike:   'teleports 4u from player (0.7s tell), cone slash 70° r=6, 40 dmg',
      summon_wraiths: 'summons 6 wraiths in ring, 10s cd',
      dark_pulse:     'room-wide pulse every 15s: shrink safe zone; stand in glowing safe circle r=4 or take 60',
    },
    phases: [
      { hpBelow: 1.0, patterns: ['spiral_bullets', 'blink_strike'] },
      { hpBelow: 0.6, patterns: ['spiral_bullets', 'blink_strike', 'summon_wraiths'], speedMult: 1.15 },
      { hpBelow: 0.3, patterns: ['spiral_bullets', 'blink_strike', 'summon_wraiths', 'dark_pulse'], speedMult: 1.3, spawn: { enemy: 'wraith', count: 4, everyS: 10 } },
    ],
  },
  emberlord: {
    name: 'The Emberlord', atS: 900, hp: 60000, speed: 2.6, dmgContact: 40, radius: 2.8, xp: 1000, gold: 500, chest: 'victory',
    patterns: {
      fire_nova:    'telegraphed r=12 burst, 55 dmg, 1.5s warning, 2 safe rings gaps',
      flame_breath: 'sweeping 90° cone for 3s, 20 dmg/0.3s',
      lava_floods:  'tiles of arena become lava for 6s, 1.5s warning, 15 dmg/s',
      meteor_storm: '16 meteors, r=3, 1.0s warning, 40 dmg',
      summon_horde: 'rings of 30 husk + 6 brutes; mini enrage',
      enrage:       'at 15% HP: all cooldowns -35%, speed x1.5, constant ember trail',
    },
    phases: [
      { hpBelow: 1.0, patterns: ['fire_nova', 'flame_breath'] },
      { hpBelow: 0.7, patterns: ['fire_nova', 'flame_breath', 'meteor_storm'], speedMult: 1.1 },
      { hpBelow: 0.4, patterns: ['fire_nova', 'flame_breath', 'meteor_storm', 'lava_floods', 'summon_horde'], speedMult: 1.2, spawn: { enemy: 'brute', count: 3, everyS: 12 } },
      { hpBelow: 0.15, patterns: ['fire_nova', 'flame_breath', 'meteor_storm', 'lava_floods', 'summon_horde', 'enrage'], speedMult: 1.5 },
    ],
  },
};
export const BOSS_RULES = { spawnPauseS: 20, normalSpawnMultDuringBoss: 0.35, bossHpBarUI: true, killRefundsAbilityCd: true, playerSpawnsSafeZoneOnIntro: true };

// ───────────────────────── PICKUPS ─────────────────────────
export const PICKUPS = {
  heal_orb: { heal: 25, dropChance: 0.004, minCooldownS: 20 },
  gold_coin: { value: 1 },
  gold_pile: { value: 10 },
  chest_small: { source: 'elite', reward: '1 free level-up choice' },
  magnet_bomb: { everyS: 120 },
  roast: { heal: 40, source: 'breakable props 5% chance' },
};

// ───────────────────────── META (GOLD SHOP) ─────────────────────────
/** Gold earned per run: floor(kills/10) + elite*5 + boss gold + minutes survived*10. Costs: base * (1 + 0.5*owned) style ramp encoded in costs[]. */
export const GOLD_RULES = { perKillsDivisor: 10, perEliteKill: 5, perMinuteSurvived: 10, victoryBonus: 300, deathKeepPct: 1.0 };
export const META_UPGRADES: { id: string; name: string; stat: string; perRank: number; maxRank: number; costs: number[] }[] = [
  { id: 'm_might',    name: 'Old Embers',     stat: 'damageMult',      perRank: 0.05, maxRank: 5, costs: [100, 200, 350, 550, 800] },
  { id: 'm_vigor',    name: 'Thick Skin',     stat: 'maxHp',           perRank: 10,   maxRank: 5, costs: [80, 160, 280, 440, 650] },
  { id: 'm_recovery', name: 'Slow Mending',   stat: 'hpRegen',         perRank: 0.2,  maxRank: 5, costs: [150, 300, 500, 800, 1200] },
  { id: 'm_greed',    name: 'Gold Fever',     stat: 'goldMult',        perRank: 0.10, maxRank: 5, costs: [120, 240, 420, 660, 960] },
  { id: 'm_growth',   name: 'Quick Study',    stat: 'xpMult',          perRank: 0.05, maxRank: 5, costs: [150, 300, 500, 800, 1200] },
  { id: 'm_magnet',   name: 'Lodestar',       stat: 'pickupRadiusMult',perRank: 0.10, maxRank: 5, costs: [60, 120, 200, 320, 480] },
  { id: 'm_haste',    name: 'Quick Hands',    stat: 'cooldownMult',    perRank: -0.03, maxRank: 5, costs: [200, 400, 700, 1100, 1600] },
  { id: 'm_reroll',   name: 'Second Thoughts',stat: 'rerolls',         perRank: 1,    maxRank: 3, costs: [200, 500, 1000] },
  { id: 'm_banish',   name: 'Banishing Rite', stat: 'banishes',        perRank: 1,    maxRank: 3, costs: [250, 600, 1200] },
  { id: 'm_revive',   name: 'Phoenix Ash',    stat: 'revives',         perRank: 1,    maxRank: 2, costs: [800, 2500] },   // revive at 50% HP, clears screen
  { id: 'm_luck',     name: 'Rabbit Foot',    stat: 'luck',            perRank: 0.05, maxRank: 5, costs: [150, 300, 500, 800, 1200] },
  { id: 'm_swift',    name: 'Light Boots',    stat: 'moveSpeedMult',   perRank: 0.03, maxRank: 5, costs: [100, 200, 350, 550, 800] },
];
/** Unlockable starting weapons (start with Ember Bolt only; others unlocked in shop; each is a distinct run feel). */
export const META_UNLOCKS: { id: string; type: 'weapon' | 'char' | 'mode'; name: string; cost: number; requires?: string }[] = [
  { id: 'unlock_orbit_blades',   type: 'weapon', name: 'Orbit Blades start',     cost: 0 }, // available in pool from start; "start with" option costs gold below
  { id: 'start_orbit_blades',    type: 'weapon', name: 'Start: Orbit Blades',    cost: 300 },
  { id: 'start_frost_nova',      type: 'weapon', name: 'Start: Frost Nova',      cost: 400 },
  { id: 'start_chain_lightning', type: 'weapon', name: 'Start: Chain Lightning', cost: 500 },
  { id: 'start_lava_trail',      type: 'weapon', name: 'Start: Lava Trail',      cost: 600 },
  { id: 'start_seeker_spears',   type: 'weapon', name: 'Start: Seeker Spears',   cost: 700 },
  { id: 'ember_burst_unlock',    type: 'mode',   name: 'Ember Burst ability (Space)', cost: 250 },
  { id: 'mode_endless',          type: 'mode',   name: 'Endless Mode (after beating Emberlord)', cost: 0, requires: 'beat_emberlord' },
  { id: 'mode_hard',             type: 'mode',   name: 'Scorched Mode: enemy HP x1.5, gold x2', cost: 1500, requires: 'beat_emberlord' },
];

// ───────────────────────── TUNING / FEEL TARGETS ─────────────────────────
export const FEEL_TARGETS = {
  firstLevelUpS: 15,
  levelUpEveryS: { early: 20, mid: 35, late: 45 },     // decision cadence ~40s average incl. chests/elites
  killsPerMinute: { min1: 40, min5: 180, min10: 400, min15: 700 },
  expectedPlayerHpLossPerMin: 'low early (<15%), 30-40% by min 10 for careless play',
  deathTimeDistribution: 'first runs die min 4-8; good build clears 15:00',
  screenShake: 'small on elite kill, large on boss slam; hitstop 40ms on crit',
  killJuice: 'gems burst outward on death; damage numbers pool-limited to 40 on screen',
};
