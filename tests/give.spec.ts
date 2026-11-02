import { test, expect } from '@playwright/test';
// QA hooks: ?give=ember_bolt:8,might:1&reward=1 shows the EVOLVE card first; picking it evolves the weapon; screenshots for docs/shots.
test('?give + ?reward show the evolution card and the evolved weapon fires', async ({ page }, info) => {
  test.setTimeout(120000); const errors: string[] = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/?give=ember_bolt:8,might:1&reward=1&seed=5&bloom=0&nodegrade=1'); await page.click('button[data-a=play]');
  await page.waitForFunction(() => (window as any).__game?.sim.state.phase === 'levelUp', null, { timeout: 60000 }); await page.waitForTimeout(1500);
  const ch = await page.evaluate(() => (window as any).__game.sim.state.levelChoices); await page.screenshot({ path: '/tmp/shot-evolution-card.png' });
  expect(ch[0]).toBe('e:ember_bolt'); await page.keyboard.press('Digit1'); await page.waitForFunction(() => (window as any).__game.sim.state.phase === 'running', null, { timeout: 15000 });
  const w = await page.evaluate(() => (window as any).__game.sim.state.players[0].weapons.find((x: any) => x.id === 'ember_bolt')); expect(w.evolved).toBe(true); expect(w.level).toBe(12);
  await page.waitForTimeout(6000); await page.screenshot({ path: '/tmp/shot-evolved-weapon.png' }); expect(errors).toEqual([]);
});
