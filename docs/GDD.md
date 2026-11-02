# EMBERHORDE — 1-page GDD (Creative Director)

**Pitch:** A lone lantern-bearer holds a glowing crystal arena against swarms of the Hollow. Move, dodge, auto-fire, grow absurdly powerful, die gloriously, unlock more. 15-min runs.

## Art style / palette
Low-poly, flat-shaded, chunky silhouettes, **dark world + hot emissive accents** (bloom does the work). Readability first: enemies = warm/saturated, player & pickups = cool/bright, ground = dark desaturated.
- Ground/bg: #0d0f1a, #171a2e, fog #1b1f3a
- Player/XP: cyan #3df2ff, teal #19c9a5; gold loot #ffd35a
- Enemies: ember orange #ff6a2b, magenta #ff2e88, toxic lime #b6ff3b; damage flash white
- Boss/danger telegraphs: red #ff3355 ground decals
Lighting: single warm rim directional + point light on player, ACES tonemap, UnrealBloom (modest), vignette, fog. Camera: ~55° tilted top-down, smooth follow, slight FOV punch on big hits.
Juice rules: hit-stop 40–60ms on crits/kills of elites, screenshake scaled by event, squash/stretch on hit, enemy death = low-poly shard burst + gem pop, damage numbers (pooled, bold), gems magnet with trail, level-up = time slow + radial flash.

## Weapons (6, each lvl 1–6, 1 evolution each with a passive pair)
1. **Ember Bolt** – auto-aim homing shots. → *Comet Barrage* (w/ Haste)
2. **Orbit Blades** – spinning blades circle you. → *Razor Halo* (w/ Might)
3. **Frost Nova** – periodic expanding ring, slows. → *Glacier Pulse* (w/ Area)
4. **Chain Lightning** – arcs between nearby enemies. → *Storm Web* (w/ Cooldown)
5. **Lava Trail** – burning pools dropped behind you. → *Magma Wake* (w/ Speed)
6. **Seeker Spears** – piercing lines thrown in movement direction. → *Spear Rain* (w/ Pierce)
Passives: Might, Haste, Area, Speed, Magnet, Max HP, Armor, Luck.

## Enemies (8)
1. Husk – slow melee swarmer (fodder)
2. Wisp – fast, fragile, erratic
3. Brute – tanky, slow, knockback-resistant
4. Spitter – ranged, telegraphed orange shot
5. Bloater – explodes into toxic pool on death
6. Skitter – packs that surround/circle
7. Wraith – phases, passes through, drains
8. Shield Knight – frontal shield, flank it (elite-tier)
Elites: glowing crown + 3× HP, drop chest (guaranteed upgrade).

## Bosses (3, at min 5 / 10 / 15; each its own arena biome)
1. **The Hollow Stag** (Ashen Woods) – charge lines + radial antler bursts.
2. **Bell-Warden** (Drowned Cathedral) – slam shockwave rings, summons Wraiths.
3. **The Unlit** (Void Garden) – multi-phase: orbiting orbs, floor-tile hazard patterns, enrage.
Biomes: Ashen Woods (orange/ash), Drowned Cathedral (teal/blue), Void Garden (violet/magenta).

## UI style
Clean, glowing "lantern" UI: thin bold sans (Rajdhani/Chakra Petch via Google Fonts), dark translucent panels, cyan/gold accents, rounded corners, soft glow. XP bar full-width top; HP bar under player; level-up = 3 big cards with icon, name, tier pips, hover lift. Title screen with animated 3D arena background, meta-upgrade shop (gold from runs, localStorage), pause, death summary with stats.

## Audio
Procedural WebAudio: punchy synth SFX (pitch-varied hit, pop, whoosh), pickup arpeggio rising per streak, level-up chime; adaptive music layers (pad → drums → bass as intensity rises, boss theme). Optional CC0 (Kenney, freesound) for samples.

## Assets
Quaternius/Kenney/Poly Pizza CC0 GLB for characters & props; otherwise procedural primitives (fine for flat-shaded look). Consistent palette via material overrides.
