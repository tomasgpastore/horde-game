import { test, expect } from '@playwright/test';
test('enemy variety + damage numbers render', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/?seed=5&bloom=0'); await page.click('button[data-a=play]'); await page.waitForTimeout(800);
  await page.evaluate(() => { const g = (window as any).__game, s = g.sim.state, e = s.enemies, p = s.players[0]; p.iframes = 1e9;
    for (let k = 0; k < 6; k++) for (let j = 0; j < 3; j++) { const i = e.count++; e.alive[i] = 1; e.kind[i] = k; e.hp[i] = 9999; const a = (k * 3 + j) / 18 * 6.283, r = 4 + j * 1.5; e.x[i] = p.x + Math.cos(a) * r; e.z[i] = p.z + Math.sin(a) * r; } });
  await page.waitForTimeout(2500); await page.screenshot({ path: info.outputPath('variety.png') });
  expect(errors).toEqual([]);
});
