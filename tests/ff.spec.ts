import { test, expect } from '@playwright/test';
test('?t=300 fast-forwards into the boss fight', async ({ page }, info) => {
  await page.goto('/?autoplay=1&t=300&nodegrade=1&bloom=0'); const t0 = Date.now(); await page.click('button[data-a=play]'); await page.waitForTimeout(1500);
  const st = await page.evaluate(() => { const s = (window as any).__game.sim.state; let al = 0; for (let i = 0; i < s.enemies.count; i++) al += s.enemies.alive[i]; return { t: s.time, boss: s.boss?.id ?? null, alive: al, lvl: s.players[0].level, hp: s.players[0].hp }; });
  console.log('FF ' + JSON.stringify(st) + ' ' + (Date.now() - t0) + 'ms'); await page.screenshot({ path: info.outputPath('ff300.png') });
  expect(st.t).toBeGreaterThan(299); expect(st.boss).toBe('hollow_stag');
});
