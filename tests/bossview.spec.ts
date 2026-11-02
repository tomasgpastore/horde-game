import { test, expect } from '@playwright/test';
test('boss spawns in view and stays near the hero; model in frame at +20s (?t=300)', async ({ page }, info) => {
  test.setTimeout(150000);
  await page.goto('/?seed=9&bloom=0&nodegrade=1'); await page.click('button[data-a=play]'); await page.waitForTimeout(500);
  const d = await page.evaluate(() => { const g = (window as any).__game, s = g.sim.state, p = s.players[0]; g.paused = true; p.iframes = 1e9; s.time = 299.99; let max = 0, min = 99, t0 = -1;
    for (let t = 0; t < 60 * 40; t++) { g.sim.step([g.bot(p)]); g.onSimEvents(s.events); if (s.boss) { if (t0 < 0) t0 = t; const dd = Math.hypot(s.enemies.x[s.boss.idx] - p.x, s.enemies.z[s.boss.idx] - p.z); max = Math.max(max, dd); if (t - t0 === 5) min = dd; } }
    return { max: +max.toFixed(1), at5ticks: +min.toFixed(1) }; });
  console.log('BOSSDIST ' + JSON.stringify(d)); expect(d.at5ticks).toBeLessThan(16); expect(d.max).toBeLessThan(24);
  await page.goto('/?t=300&autoplay=1&nodegrade=1&bloom=0'); await page.click('button[data-a=play]'); await page.waitForTimeout(20000);
  const inFrame = await page.evaluate(() => { const g = (window as any).__game, v = g.renderer.bossView.cur; if (!v) return null; const pr = v.boss.group.position.clone().project(g.renderer.camera); return { x: +pr.x.toFixed(2), y: +pr.y.toFixed(2) }; });
  console.log('BOSSNDC ' + JSON.stringify(inFrame)); await page.screenshot({ path: info.outputPath('boss20.png') });
  expect(inFrame && Math.abs(inFrame.x) < 1 && Math.abs(inFrame.y) < 1).toBeTruthy();
});
