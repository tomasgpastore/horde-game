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

test('dash moves fast and grants i-frames', async ({ page }) => {
  await page.goto('/?seed=3&bloom=0'); await page.click('button[data-a=play]'); await page.waitForTimeout(500);
  const r = await page.evaluate(() => { const g = (window as any).__game; g.paused = true; const s = g.sim.state, p = s.players[0]; p.iframes = 0;
    const x0 = p.x; g.sim.step([{ moveX: 1, moveZ: 0, aimX: 0, aimZ: 1, dash: true, ability: false }]);
    const i = p.iframes; for (let k = 0; k < 10; k++) g.sim.step([{ moveX: 1, moveZ: 0, aimX: 0, aimZ: 1, dash: false, ability: false }]);
    return { dx: p.x - x0, i, cd: p.dashCooldown }; });
  if (!(r.dx > 3 && r.i > 0.2 && r.cd > 0)) throw new Error(JSON.stringify(r));
});
