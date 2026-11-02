# EMBERHORDE balance (Game Designer)

Source data: `src/game/sim/content/balance.ts` (reference targets, not wired in yet).

## Pacing targets
- First level-up ~0:15, build decision every ~40s (level 5 @1:10, 10 @3:00, 20 @8:00, 30 @13:00).
- Alive enemies: ~40 @0:30, ~60 @1:00, 150 @5:00, 280 @10:00, 420 @15:00 (cap 450, live MAX_ALIVE 400).
- Bosses at 5/10/15 min; boss chest grants weapon evolution (weapon lvl max + paired passive).

## Weapon / passive pairs (evolution)
ember_bolt+might, orbit_blades+swiftness, frost_nova+bulwark, chain_lightning+haste, lava_trail+vitality, seeker_spears+fortune.

## Level-up cards
3 cards (4 at luck>=0.5), 1 reroll + 1 banish per run, skip = +25 gold; early guarantees of new weapons and weapon upgrades; rare/epic weights scale with luck.

## Meta shop
12 upgrades x up to 5 ranks (100-1600 gold) plus starting-weapon unlocks. Gold = kills/10 + elites*5 + boss gold + 10/min survived.

## Open tuning notes
See PR description for playtest-driven numbers.
