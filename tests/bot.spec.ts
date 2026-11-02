import { test, expect } from '@playwright/test';
// Drives the autoplay bot headlessly via sim stepping; asserts it never strays near the edge, then screenshots at 0:40 and 2:00.
test('bot stays central; screenshots at 0:40 and 2:00', async ({ page }) => {
  test.setTimeout(240000); // simulating 2 minutes of ticks in-page is CPU-bound; don't fail on a loaded CI box
  await page.goto('/?seed=5&autoplay=1&nodegrade=1'); await page.click('button[data-a=play]'); await page.waitForTimeout(500);
  let maxR = 0;
  for (const target of [40, 120]) {
    let r: any = { mr: 0 };
    for (let t = (target === 40 ? 0 : 40) + 15; ; t += 15) { const goal = Math.min(t, target);
    const part = await page.evaluate((target) => { const g = (window as any).__game, s = g.sim.state, p = s.players[0]; g.paused = true; let mr = 0;
      while (s.time < target && s.phase !== 'gameOver') { p.iframes = 1e9; if (s.phase === 'levelUp') { g.sim.choose(s.tick % 3); continue; } g.sim.step([g.bot(p)]); mr = Math.max(mr, Math.hypot(p.x, p.z)); }
      g.paused = false; g.running = false; return { mr, R: g.sim.arena.radius, t: s.time, over: s.phase === 'gameOver' }; }, goal);
    r = { ...part, mr: Math.max(r.mr, part.mr) }; if (goal >= target || part.over) break; }
    await page.evaluate(() => (window as any).__game.renderer.rig.snap());
    maxR = Math.max(maxR, r.mr); console.log('BOT ' + JSON.stringify(r)); await page.waitForTimeout(2000);
    await page.screenshot({ path: `/tmp/bot_${target}.png` });
    await page.evaluate(() => { const g = (window as any).__game; g.paused = true; g.running = true; });
  }
  expect(maxR).toBeLessThan(24);
});
