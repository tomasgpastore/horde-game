import { test, expect } from '@playwright/test';
import { watchErrors } from './helpers/errors';

// 60s bot run (?autoplay=1): screenshot + state every 10s. Gate: no console errors, sim progresses, kills happen.
test('autoplay 60s', async ({ page }, info) => {
  test.setTimeout(150000);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?autoplay=1&seed=7'); await page.click('button[data-a=play]'); await page.waitForTimeout(1500);
  const log: any[] = [];
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(10000);
    await page.screenshot({ path: info.outputPath(`auto-${i}.png`) });
    log.push(await page.evaluate(() => { const g = (window as any).__game, s = g.sim.state, p = s.players[0];
      return { tick: s.tick, wave: s.wave, kills: s.kills, enemies: s.enemies.count, hp: Math.round(p.hp), lvl: p.level, phase: s.phase, fps: +g.fps.toFixed(1) }; }));
  }
  console.log('AUTOPLAY ' + JSON.stringify(log));
  await info.attach('autoplay.json', { body: JSON.stringify(log, null, 1), contentType: 'application/json' });
  await page.waitForFunction(() => (window as any).__game.sim.state.kills > 0, null, { timeout: 90000, polling: 500 }); // slow runners: wait for sim, not wall-clock
  log.push(await page.evaluate(() => { const s = (window as any).__game.sim.state; return { tick: s.tick, kills: s.kills }; }));
  expect(log[log.length - 1].tick).toBeGreaterThan(log[0].tick);
  expect(log[log.length - 1].kills).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
