import { test, expect } from '@playwright/test';
// Real game loop (no direct stepping): autoplay from 4:59 kills the Hollow Stag, picks the reward card, and the game swaps to the Drowned Cathedral.
test('?t=299&autoplay reaches biome 2 through the real loop', async ({ page }) => {
  test.skip(!(globalThis as any).process?.env?.SLOW_E2E, 'slow (~3 min on software GL): run with SLOW_E2E=1');
  test.setTimeout(240000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/?t=299&autoplay=1&nodegrade=1&bloom=0'); await page.click('button[data-a=play]');
  await page.waitForFunction(() => (window as any).__game?.sim.arena.id === 'drowned_cathedral' && (window as any).__game.renderer.arenaId === 'drowned_cathedral', null, { timeout: 200000, polling: 500 });
  const st = await page.evaluate(() => { const s = (window as any).__game.sim.state; return { t: Math.round(s.time), biome: s.biome, phase: s.phase }; });
  console.log('E2E ' + JSON.stringify(st)); expect(st.biome).toBe(1); expect(errors).toEqual([]);
});
