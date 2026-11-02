# Deploy & rollback

- Live: https://emberhorde.fly.dev (Fly app `emberhorde`, config in `fly.toml`). Health: `/healthz`. WebSocket: `wss://emberhorde.fly.dev/ws` (same port).
- Every push to `main` runs `.github/workflows/deploy.yml`: `flyctl deploy --remote-only`, then a smoke test (`/healthz` and `/` must return 200, else the run fails). Runs are serialized; the newest commit always wins.
- Single machine on purpose: in-memory WS rooms break across machines. Always deploy with `--ha=false`.
- Manual deploy: `fly deploy --remote-only --ha=false` (needs `FLY_API_TOKEN`).

## Rollback
1. Fast: `git revert <bad-sha> && git push` (redeploys automatically), or
2. Instant, no rebuild: `fly releases -a emberhorde --image` to find the last good image, then `fly deploy -a emberhorde --image <registry.fly.io/emberhorde:deployment-XXXX>`.
Note: the next push to main redeploys main, so also revert the bad commit.
