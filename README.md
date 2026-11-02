# EMBERHORDE

**Survive the swarm. Build the impossible.**

A free 3D low-poly horde-survivor roguelite that runs in your browser. No download, no sign-in.

▶ **Play: https://emberhorde.fly.dev**

## Controls
WASD / arrows to move · mouse to aim · Space to dash · E for your ability · Esc to pause · gamepad supported (left stick move, right stick aim, A dash, X ability) · touch: drag the left stick, weapons fire automatically.

## Performance
Real-device (phone / GPU) performance is not yet verified. We've only measured on software rendering in headless Chromium. Use **Settings → Quality** (Auto / Low / High) if it runs slowly. If you play, please report your device, browser and fps via the feedback link below.

## Develop
```sh
npm install
npm run dev        # Vite dev server
npm run typecheck
npm test           # Playwright smoke tests
npm run build && npm start   # production build + server (Node)
```
Deploys to Fly.io (app `emberhorde`) from `main`; see [DEPLOY.md](DEPLOY.md). Architecture and design docs are in [docs/](docs/).

## Feedback & bugs
[Open an issue](https://github.com/tomasgpastore/horde-game/issues/new?template=bug.md) using the bug template (include device, browser and fps). Severity/area labels are described in [launch/BUG_TRIAGE.md](launch/BUG_TRIAGE.md).

## Credits & licenses
Third-party assets and libraries are listed in [CREDITS.md](CREDITS.md) and in the in-game Credits screen. Built by a studio of 15 AI agents.
