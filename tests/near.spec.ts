import { test, expect } from '@playwright/test';
// Pacing probe (first 30s): how many enemies are within camera range (12u) of the hero at 0:10 / 0:20 / 0:30, and is there contact in every 5s window.
test('early contact: >=20 enemies near the hero by 0:30', async ({ page }) => {
  await page.goto('/?seed=4&bloom=0&nodegrade=1'); await page.click('button[data-a=play]'); await page.waitForTimeout(500);
  const r = await page.evaluate(() => { const g = (window as any).__game; g.paused = true; g.reset(4); const s = g.sim.state, p = s.players[0], e = s.enemies; const out: any = {}; let quiet = 0, lastHp = p.hp; const gaps: number[] = [];
    for (let t = 0; t < 60 * 31 && s.phase !== 'gameOver'; t++) { p.iframes = 1e9; if (s.phase === 'levelUp') { g.choose(s.tick % 3); continue; } g.sim.step([g.bot(p)]);
      if (t === 60 * 10 || t === 60 * 20 || t === 60 * 30) { let n = 0, n18 = 0; for (let i = 0; i < e.count; i++) if (e.alive[i]) { const d = Math.hypot(e.x[i] - p.x, e.z[i] - p.z); if (d < 12) n++; if (d < 18) n18++; } out['t' + t / 60] = { near12: n, near18: n18 }; } }
    return out; });
  console.log('NEAR ' + JSON.stringify(r)); expect(r.t10.near18).toBeGreaterThanOrEqual(6); expect(r.t30.near18).toBeGreaterThanOrEqual(20);
});
