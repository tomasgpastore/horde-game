import { test } from '@playwright/test';
test('sim step cost at scale', async ({ page }) => {
  await page.goto('/?seed=4&bloom=0&nodegrade=1'); await page.click('button[data-a=play]'); await page.waitForTimeout(500);
  const r = await page.evaluate(() => { const g = (window as any).__game; g.paused = true; g.reset(4); const s = g.sim.state, p = s.players[0]; const rows: any[] = []; let acc = 0, n = 0, worst = 0;
    for (let t = 0; t < 60 * 420 && s.phase !== 'gameOver'; t++) { p.iframes = 1e9; if (s.phase === 'levelUp') { g.sim.choose(s.tick % 3); continue; }
      const a = performance.now(); g.sim.step([g.bot(p)]); const d = performance.now() - a; acc += d; n++; worst = Math.max(worst, d);
      if (s.tick % (60 * 30) === 0) { let al = 0, gems = 0, pr = 0; for (let i = 0; i < s.enemies.count; i++) al += s.enemies.alive[i]; for (let i = 0; i < s.pickups.count; i++) gems += s.pickups.alive[i]; for (let i = 0; i < s.projectiles.count; i++) pr += s.projectiles.alive[i];
        rows.push({ t: Math.round(s.time), alive: al, gems, proj: pr, enemyCount: s.enemies.count, pkCount: s.pickups.count, avgMs: +(acc / n).toFixed(3), worstMs: +worst.toFixed(2) }); acc = 0; n = 0; worst = 0; } }
    return rows; });
  console.log('SIMPERF ' + JSON.stringify(r)); const { expect } = await import('@playwright/test'); expect(Math.max(...r.map((x: any) => x.avgMs))).toBeLessThan(4); expect(Math.max(...r.map((x: any) => x.gems))).toBeLessThan(700);
});
