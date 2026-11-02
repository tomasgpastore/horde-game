# Post-launch gameplay backlog (Gameplay Engineer)

Source: code audit of `main` against `docs/GDD.md` plus a headless autoplay run of the live build (not a human playtest). **Items 1-3 are unverified in-game**; confirm before building. All are post-launch; nothing here is a crash or softlock.

| # | Item | GDD ref | Suggested sim file | Size |
|---|------|---------|--------------------|------|
| 1 | Bloater: toxic burst / pool on death (no death behaviour in the sim) | Enemies #5 | `sim/systems/projectiles.ts` (`killEnemy`) + hostile shots as in `spitters.ts` | S |
| 2 | Shield Knight: frontal shield, flank to damage | Enemies #8 | `sim/systems/projectiles.ts` / `weapons.ts` damage path (facing check) | M |
| 3 | Skitter: pack surround/circle behaviour | Enemies #6 | `sim/systems/swarms.ts` | S |
| 4 | Wraith: blink / fade-in phase | Enemies #7 | `sim/systems/enemies.ts` + a new SimEvent in `shared/types.ts` for render | M |
| 5 | Level-up reroll / banish (in Designer CARD_RULES, not wired) | UI style (level-up cards) | `sim/index.ts` (`choose`) + `content/upgrades.ts` + `ui` | M |
| 6 | Meta shop: spend gold between runs (gold is counted, nothing to buy) | UI style (meta-upgrade shop) | new meta module (shell/localStorage) | L |
| 7 | Elites keep spawning every ~40s during a boss fight and pile up around the boss. Fix: skip the elite spawn while `s.boss` is set (one line). (Boss time-to-kill concern from the stale live build is already fixed on main: boss-priority auto-aim, ttk 35-100s.) | Bosses / Elites | `sim/systems/elites.ts` | S |

Dropped from the earlier list: chests / boss rewards chaining into cards is by design.
