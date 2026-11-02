import { test, expect } from '@playwright/test';
import { watchErrors } from './helpers/errors';
test('boots, renders, sim advances', async ({ page }, info) => {
  const errors = watchErrors(page);
  await page.goto('/'); await page.click('button[data-a=play]'); await page.waitForTimeout(3000);
  await page.keyboard.down('KeyD'); await page.waitForTimeout(1500); await page.keyboard.up('KeyD');
  const st = await page.evaluate(() => { const g = (window as any).__game; return { tick: g.sim.state.tick, x: g.sim.state.players[0].x, fps: g.fps, enemies: g.sim.state.enemies.count }; });
  console.log(JSON.stringify(st));
  await page.screenshot({ path: info.outputPath('shot.png') });
  expect(st.tick).toBeGreaterThan(60); expect(st.x).toBeGreaterThan(1); expect(errors).toEqual([]);
});
