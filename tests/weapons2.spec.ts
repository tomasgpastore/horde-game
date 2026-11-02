import { test, expect } from '@playwright/test';
// lava_trail + seeker_spears: fire, kill, and stay deterministic for a fixed seed + input stream.
test('lava trail and seeker spears kill deterministically', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/?seed=21&bloom=0'); await page.click('button[data-a=play]'); await page.waitForTimeout(500);
  const run = () => page.evaluate(() => {
    const g = (window as any).__game; g.paused = true; g.reset?.();
    const s = g.sim.state, p = s.players[0]; p.weapons.length = 0;
    for (const id of ['lava_trail', 'seeker_spears']) p.weapons.push({ id, level: 3, cooldown: 0 });
    const inp = { moveX: 0.6, moveZ: 0.2, aimX: 0, aimZ: 1, dash: false, ability: false }; p.iframes = 1e9;
    let lava = 0, spears = 0;
    for (let i = 0; i < 1500 && s.phase !== 'gameOver'; i++) { if (s.phase === 'levelUp') g.sim.choose(0); else g.sim.step([inp]);
      const pr = s.projectiles; for (let k = 0; k < pr.count; k++) if (pr.alive[k]) { if (pr.kind[k] === 4) lava++; if (pr.kind[k] === 5) spears++; } }
    return { kills: s.kills, lava: lava > 0, spears: spears > 0, x: Math.round(p.x * 100), z: Math.round(p.z * 100) };
  });
  const a = await run(); const b = await run();
  console.log(JSON.stringify(a)); expect(a.lava).toBe(true); expect(a.spears).toBe(true); expect(a.kills).toBeGreaterThan(5);
  expect(b).toEqual(a); expect(errors).toEqual([]);
});
