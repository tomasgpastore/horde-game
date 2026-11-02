# Deploy & rollback

- Live: https://horde-game-live.fly.dev (Fly app `horde-game-live`, config in `fly.toml`). Health: `/healthz`. WebSocket: `wss://horde-game-live.fly.dev/ws` (same port).
- Every push to `main` runs `.github/workflows/deploy.yml`: `flyctl deploy --remote-only`, then a smoke test (`/healthz` and `/` must return 200, else the run fails). Runs are serialized; the newest commit always wins.
- Manual deploy: `fly deploy --remote-only` (needs `FLY_API_TOKEN`).

## Rollback
1. Fast: `git revert <bad-sha> && git push` (redeploys automatically), or
2. Instant, no rebuild: `fly releases -a horde-game-live --image` to find the last good image, then `fly deploy -a horde-game-live --image <registry.fly.io/horde-game-live:deployment-XXXX>`.
Note: the next push to main redeploys main, so also revert the bad commit.
