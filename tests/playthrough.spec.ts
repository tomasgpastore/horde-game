import { test, expect } from '@playwright/test';
import { watchErrors } from './helpers/errors';

// ~30s scripted playthrough: moves in a circle, dashes, aims with mouse, screenshots every 3s.
test('scripted playthrough', async ({ page }, info) => {
  test.setTimeout(120000);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/'); await page.click('button[data-a=play]'); await page.waitForTimeout(2500);
  const keys = ['KeyD', 'KeyS', 'KeyA', 'KeyW'];
  const log: any[] = [];
  for (let i = 0; i < 10; i++) {
    const k = keys[i % 4], k2 = keys[(i + 1) % 4];
    await page.keyboard.down(k); await page.keyboard.down(k2);
    await page.mouse.move(640 + 200 * Math.cos(i), 360 + 150 * Math.sin(i));
    await page.mouse.down();
    if (i % 3 === 0) await page.keyboard.press('Space');
    await page.waitForTimeout(3000);
    await page.mouse.up(); await page.keyboard.up(k); await page.keyboard.up(k2);
    // pick first level-up card if the game paused for it
    const phase = await page.evaluate(() => (window as any).__game.sim.state.phase);
    if (phase === 'levelUp') { await page.keyboard.press('Digit1'); await page.keyboard.press('Enter'); }
    await page.screenshot({ path: info.outputPath(`play-${String(i).padStart(2, '0')}.png`) });
    log.push(await page.evaluate(() => { const s = (window as any).__game.sim.state, g = (window as any).__game; const p = s.players[0];
      return { tick: s.tick, wave: s.wave, kills: s.kills, enemies: s.enemies.count, hp: p.hp, lvl: p.level, phase: s.phase, x: +p.x.toFixed(1), z: +p.z.toFixed(1), fps: +g.fps.toFixed(1) }; }));
  }
  console.log('PLAYTHROUGH ' + JSON.stringify(log));
  await info.attach('playthrough.json', { body: JSON.stringify(log, null, 1), contentType: 'application/json' });
  expect(log[9].tick).toBeGreaterThan(log[0].tick);
  expect(errors).toEqual([]);
});
