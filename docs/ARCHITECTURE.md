# Emberhorde architecture (Tech Lead)

3D low-poly horde-survivor roguelite. Three.js + TS + Vite. Path aliases: @shared @sim @engine @render @world @net @ui @audio.

## Golden rules
1. **`src/sim` is pure & deterministic**: no three, no DOM, no Math.random/Date.now/performance.now. Randomness only via `ctx.rng`. Fixed 60Hz tick. This lets the Node WS server run the same code (co-op).
2. **Render/UI/Audio only READ `SimState`** and react to `state.events` (cleared each tick). They never mutate sim.
3. **Data-oriented hot path**: enemies/projectiles/pickups are struct-of-arrays pools (`@shared/types`). Render with InstancedMesh. No per-entity objects/allocations in tick or frame loop. Use a spatial hash for collisions.
4. Content (enemy kinds, weapons, upgrades, waves) = data tables in `src/sim/content/*` (Gameplay owns), no magic numbers in systems.
5. `src/shared/*` changes need Tech Lead review. Everything else: owner merges after 1 review.

## Ownership (folders = conflict boundaries)
| Folder | Owner |
|---|---|
| src/engine, src/render, src/audio(engine side) | Engine Engineer: camera, lights, post-fx, particles, instanced pools, input (gamepad/touch), perf |
| src/sim/systems, src/sim/content, src/ui | Gameplay Engineer: player, dash, weapons, enemies AI, xp/levelup, bosses, HUD/cards |
| src/world | World Engineer: arenas, props, obstacles, spawn tables/waves pacing, biomes, procedural scenery |
| src/netcode, server/ | Netcode Engineer: NetSession impls, WS authoritative server (reuses @sim), snapshots |
| tests/, .github/ | QA Engineer: Playwright screenshots+video each PR, determinism test, perf test (300+ enemies fps) |
| Dockerfile, server/static.mjs, fly.toml | DevOps (Launch Lead) / Netcode |

## Flow
`Game.frame`: poll input -> `Sim.step(inputs)` x N at 60Hz -> consume events (audio/fx) -> `Renderer.render(state, dt, alpha)` -> HUD.
Add a system: `src/sim/systems/foo.ts` exporting `System`; register in `Sim.systems` (order matters, in `src/sim/index.ts`).

## Workflow
Branch `feat/<area>-<thing>`, small PRs to `main`, CI must pass (typecheck+build+Playwright smoke). Don't push to main. `window.__game` is the QA hook (sim.state, fps).
Perf budget: 60fps with 300+ enemies, <= ~150 draw calls, no GC spikes.

## Run
`npm i && npm run dev` · `npm run build` · `npm test` (Playwright) · `docker build .` -> serves dist on :8080.
