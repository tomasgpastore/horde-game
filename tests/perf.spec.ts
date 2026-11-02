import { test, expect } from '@playwright/test';
// Render budget guard: draw calls and triangles are exact even on software GL (fps isn't), so regressions fail CI.
test('render budget: <150 draw calls, <250k tris with 800 enemies', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/?seed=5&nodegrade=1'); await page.click('button[data-a=play]'); await page.waitForTimeout(1500);
  await page.evaluate(() => { const g = (window as any).__game, e = g.sim.state.enemies, me = g.sim.state.players[0];
    for (let i = 0; i < 800; i++) { const a = i * 2.4, r = 4 + (i % 40) * 0.5; e.alive[i] = 1; e.kind[i] = i % 8; e.x[i] = me.x + Math.cos(a) * r; e.z[i] = me.z + Math.sin(a) * r; e.hp[i] = 1e6; }
    e.count = 800; g.paused = true; }); // freeze sim so the scene is stable; render keeps running
  await page.waitForFunction(() => (window as any).__game.perf.enemyCount >= 800 && (window as any).__game.perf.calls > 0, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const p = await page.evaluate(() => { const x = (window as any).__game.perf; return { calls: x.calls, tris: x.tris, enemies: x.enemyCount }; });
  console.log('PERF ' + JSON.stringify(p));
  expect(p.calls).toBeLessThan(150); expect(p.tris).toBeLessThan(250_000);
});
