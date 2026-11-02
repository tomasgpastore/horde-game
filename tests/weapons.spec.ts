import { test, expect } from '@playwright/test';
test('all weapons fire without errors', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/?autoplay=1&seed=11'); await page.click('button[data-a=play]'); await page.waitForTimeout(1000);
  await page.evaluate(() => { const p = (window as any).__game.sim.state.players[0]; for (const id of ['orbit_blades', 'frost_nova', 'chain_lightning']) p.weapons.push({ id, level: 3, cooldown: 0 }); });
  await page.waitForTimeout(12000);
  const st = await page.evaluate(() => { const s = (window as any).__game.sim.state; return { kills: s.kills, t: s.time }; });
  console.log(JSON.stringify(st)); await page.screenshot({ path: info.outputPath('weapons.png') });
  expect(st.kills).toBeGreaterThan(5); expect(errors).toEqual([]);
});
