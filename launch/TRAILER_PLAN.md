# Trailer / GIF plan
Deliverables: `hero.gif` (≤8MB, 6–8s loop, 800px wide), `trailer.mp4` (20–30s, 1080p), `og.png` (1200x630).

## Shot list (20–30s)
1. 0–3s: calm start, hero alone, title card.
2. 3–10s: first enemies, auto-attacks, XP gems collected.
3. 10–15s: level-up upgrade pick (UI shot).
4. 15–24s: horde of hundreds, big weapon effects, screenshake.
5. 24–30s: boss/death or victory, title + URL.

## Capture
Script: `scripts/capture.mjs` (Playwright, Chromium, `--use-gl=swiftshader`/`angle`). Needs a debug hook from Gameplay: `?seed=N&autoplay=1&god=1` (autoplay bot + invulnerable) so capture is deterministic and attractive. Records video at 1280x720 via `recordVideo`; screenshots on interval.
Convert: `ffmpeg -i in.webm -vf "fps=20,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" hero.gif`
