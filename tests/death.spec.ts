import { test, expect } from '@playwright/test';
// Non-invulnerable death in the REAL loop: hero at 1 HP with an enemy on top -> game:over -> results card visible with stats.
test('death shows the results card', async ({ page }, info) => {
  test.setTimeout(120000); const errors: string[] = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/?seed=8&bloom=0&nodegrade=1'); await page.click('button[data-a=play]');
  await page.waitForFunction(() => (window as any).__game?.sim.state.tick > 30, null, { timeout: 60000 });
  await page.evaluate(() => { const g = (window as any).__game, s = g.sim.state, p = s.players[0], e = s.enemies; p.hp = 1; p.iframes = 0;
    const i = e.count++; e.alive[i] = 1; e.kind[i] = 2; e.flags[i] = 0; e.hp[i] = 1e9; e.x[i] = p.x; e.z[i] = p.z; });
  await page.waitForFunction(() => { const el = document.querySelector('.results.defeat') as HTMLElement | null; return !!el && el.offsetParent !== null; }, null, { timeout: 60000, polling: 250 });
  const txt = await page.evaluate(() => (document.querySelector('.results.defeat') as HTMLElement).innerText.replace(/\s+/g, ' ').slice(0, 200));
  console.log('RESULTS ' + txt); await page.waitForTimeout(1500); await page.screenshot({ path: info.outputPath('results.png') });
  expect(txt).toContain('YOU FELL'); expect(errors).toEqual([]);
});
