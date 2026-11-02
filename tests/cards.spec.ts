import { test, expect } from '@playwright/test';
test('level-up cards show and resolve', async ({ page }, info) => {
  await page.goto('/?seed=3'); await page.click('button[data-a=play]'); await page.waitForTimeout(1500);
  await page.evaluate(() => { (window as any).__game.sim.state.players[0].xp = (window as any).__game.sim.state.players[0].xpToNext; });
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => (window as any).__game.sim.state.phase)).toBe('levelUp');
  await page.screenshot({ path: info.outputPath('cards.png') });
  await page.keyboard.press('Digit2'); await page.waitForTimeout(300);
  const st = await page.evaluate(() => { const g = (window as any).__game.sim.state; return [g.phase, g.players[0].level]; });
  expect(st[0]).not.toBe('levelUp');
});
