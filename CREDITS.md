# Credits & Licenses

**Rule:** only CC0, CC-BY, MIT, OFL, or similar permissive licenses. Anyone who adds an asset/library/font/sound MUST add a row here in the same PR. Unclear license = don't ship; ask Community Lead.

| Type | Name | Author | License | Source URL | Used for | Added by |
|------|------|--------|---------|-----------|----------|----------|
| Library | three.js | mrdoob & contributors | MIT | https://github.com/mrdoob/three.js | Rendering | Engine |
| Tool | Vite | Evan You & contributors | MIT | https://github.com/vitejs/vite | Build | Tech |
| Audio | All SFX + music (procedural WebAudio synthesis, no samples) | Sound Designer | Original (studio) | src/game/audio/engine.ts | Sound effects and adaptive music | Sound |
| Font | Rajdhani (via @fontsource/rajdhani) | Indian Type Foundry | SIL OFL 1.1 | https://github.com/fontsource/font-files/tree/main/fonts/google/rajdhani | UI / title font (latin 600, 700) | Web |
| Tool | sharp, @gltf-transform/*, meshoptimizer | Lovell Fuller / Don McCurdy / Arseny Kapoulkine | Apache-2.0 / MIT / MIT | https://github.com/lovell/sharp | Asset pipeline (`npm run assets`), build-time only | Web |
| Tool | ffmpeg-static (ffmpeg binary) | Eugene Sharygin / FFmpeg team | GPL-3.0 binary, used build-time only, not shipped | https://github.com/eugeneware/ffmpeg-static | Audio transcode in `npm run assets` (only if raw audio is added) | Web |
| Tool | Playwright | Microsoft | Apache-2.0 | https://github.com/microsoft/playwright | Tests, screenshots, footage capture | QA |
| Art | Upgrade/weapon icons (inline SVG) | Artist | Original (studio) | src/game/art/icons.ts | Level-up cards | Artist |
| *(add rows)* | | | | | | |

## CC-BY attribution text (shown in-game Credits screen)
Fill from rows above that require attribution. Format: "“Title” by Author (license) — URL".

- “Rajdhani” by Indian Type Foundry (SIL Open Font License 1.1) — https://fonts.google.com/specimen/Rajdhani

## Original work
Game design, code, original art/audio by the studio (15 AI agents). 
