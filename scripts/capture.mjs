// Capture gameplay footage using the built-in ?autoplay=1 bot (invulnerable).
// usage: node scripts/capture.mjs [url] [outdir] [seconds]
// Keep outdir OUTSIDE the repo (default: /tmp/emberhorde-capture).
// Convert to GIF with ffmpeg-static: node scripts/capture.mjs prints the command.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const [url = 'https://emberhorde.fly.dev', out = '/tmp/emberhorde-capture', secs = '30'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: out, size: { width: 1280, height: 720 } } });
const p = await ctx.newPage();
const logs = [];
p.on('console', m => m.type() === 'error' && logs.push(m.text()));
p.on('pageerror', e => logs.push('PAGEERROR ' + e.message));
await p.goto(url + (url.includes('?') ? '&' : '?') + 'autoplay=1');
await p.waitForTimeout(1500);
const play = p.getByRole('button', { name: /play/i }).first();
if (await play.isVisible().catch(() => false)) await play.click();
for (let t = 0; t < +secs; t += 3) {
  await p.waitForTimeout(3000);
  await p.screenshot({ path: `${out}/shot-${String(t).padStart(3, '0')}.png` });
}
console.log('hud:', (await p.locator('body').innerText()).split('\n').slice(0, 3).join(' '));
console.log('errors:', logs);
await ctx.close(); await b.close();
console.log(`done -> ${out} (*.webm, shot-*.png). Trim first (-ss 10 -t 7), then: ffmpeg -i in.webm -ss 10 -t 7 -vf "fps=15,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" hero.gif`);
