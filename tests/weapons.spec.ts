import { test, expect } from '@playwright/test';
// Drives the sim directly (render speed in software GL is irrelevant) — then screenshots the render.
test('all weapons fire and kill (deterministic stepping)', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/?seed=11&bloom=0'); await page.click('button[data-a=play]'); await page.waitForTimeout(500);
  const st = await page.evaluate(() => {
    const g = (window as any).__game; g.paused = true; const s = g.sim.state, p = s.players[0];
    for (const id of ['orbit_blades', 'frost_nova', 'chain_lightning']) p.weapons.push({ id, level: 3, cooldown: 0 });
    const inp = { moveX: 0.3, moveZ: 0.2, aimX: 0, aimZ: 1, dash: false, ability: false }; p.iframes = 1e9;
    for (let i = 0; i < 1800 && s.phase !== 'gameOver'; i++) { if (s.phase === 'levelUp') g.sim.choose(0); else g.sim.step([inp]); }
    return { kills: s.kills, t: s.time, level: p.level };
  });
  console.log(JSON.stringify(st)); await page.waitForTimeout(500); await page.screenshot({ path: info.outputPath('weapons.png') });
  expect(st.kills).toBeGreaterThan(30); expect(errors).toEqual([]);
});
