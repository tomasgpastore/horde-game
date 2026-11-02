// usage: node scripts/capture.mjs <url> <outdir> [seconds]
import { chromium } from 'playwright';
const [url, out = 'capture', secs = '30'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: out, size: { width: 1280, height: 720 } } });
const p = await ctx.newPage();
const logs = [];
p.on('console', m => m.type() === 'error' && logs.push(m.text()));
p.on('pageerror', e => logs.push('PAGEERROR ' + e.message));
await p.goto(url + (url.includes('?') ? '&' : '?') + 'autoplay=1');
for (let i = 0; i < +secs; i += 3) { await p.waitForTimeout(3000); await p.screenshot({ path: `${out}/shot-${String(i).padStart(3, '0')}.png` }); }
console.log('errors:', logs);
await ctx.close(); await b.close();
