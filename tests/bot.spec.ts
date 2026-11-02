import { test, expect } from '@playwright/test';
// Drives the autoplay bot headlessly via sim stepping; asserts it never strays near the edge, then screenshots at 0:40 and 2:00.
test('bot stays central; screenshots at 0:40 and 2:00', async ({ page }) => {
  await page.goto('/?seed=5&autoplay=1&nodegrade=1'); await page.click('button[data-a=play]'); await page.waitForTimeout(500);
  let maxR = 0;
  for (const target of [40, 120]) {
    const r = await page.evaluate((target) => { const g = (window as any).__game, s = g.sim.state, p = s.players[0]; g.paused = true; let mr = 0;
      while (s.time < target && s.phase !== 'gameOver') { p.iframes = 1e9; if (s.phase === 'levelUp') { g.sim.choose(s.tick % 3); continue; } g.sim.step([g.bot(p)]); mr = Math.max(mr, Math.hypot(p.x, p.z)); }
      g.renderer.rig.snap(); g.paused = false; g.running = false; return { mr, R: g.sim.arena.radius, t: s.time }; }, target);
    maxR = Math.max(maxR, r.mr); console.log('BOT ' + JSON.stringify(r)); await page.waitForTimeout(2000);
    await page.screenshot({ path: `/tmp/bot_${target}.png` });
    await page.evaluate(() => { const g = (window as any).__game; g.paused = true; g.running = true; });
  }
  expect(maxR).toBeLessThan(24);
});
