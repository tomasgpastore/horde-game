import { test, expect } from '@playwright/test';
test('vertical slice: autoplay kills, gains xp, levels up', async ({ page }, info) => {
  test.setTimeout(180000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/?autoplay=1&seed=7&bloom=0&nodegrade=1'); await page.click('button[data-a=play]'); await page.waitForFunction(() => { const s = (window as any).__game?.sim.state; return s && s.kills > 5 && s.players[0].level > 1; }, null, { timeout: 150000, polling: 500 }); // poll sim state, not wall-clock (slow CI runners)
  const st = await page.evaluate(() => { const s = (window as any).__game.sim.state; return { kills: s.kills, level: s.players[0].level, hp: s.players[0].hp, t: s.time, enemies: s.enemies.count, phase: s.phase }; });
  console.log(JSON.stringify(st)); await page.screenshot({ path: info.outputPath('slice.png') });
  expect(st.kills).toBeGreaterThan(5); expect(st.level).toBeGreaterThan(1); expect(errors).toEqual([]);
});
