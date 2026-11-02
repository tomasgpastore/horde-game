import { test, expect } from '@playwright/test';
// Headless sim-only density probe: invulnerable player moving in a circle, picks first card each level-up.
test('density', async ({ page }) => {
  await page.goto('/?seed=4&bloom=0'); await page.click('button[data-a=play]'); await page.waitForTimeout(500);
  const r = await page.evaluate(() => { const g = (window as any).__game; g.paused = true; g.reset(); const s = g.sim.state, p = s.players[0]; const out: any[] = []; // reset => deterministic start regardless of wall-clock
    for (let t = 0; t < 60 * 330 && s.phase !== 'gameOver'; t++) { p.iframes = 1e9; if (s.phase === 'levelUp') { g.sim.choose(s.tick % 3); continue; }
      const a = s.time * 0.6; g.sim.step([{ moveX: Math.cos(a), moveZ: Math.sin(a), aimX: 0, aimZ: 1, dash: false, ability: false }]);
      if (t % (60 * 30) === 0) { let al = 0; for (let i = 0; i < s.enemies.count; i++) al += s.enemies.alive[i]; out.push({ min: +(s.time / 60).toFixed(1), alive: al, kills: s.kills, lvl: p.level }); } }
    return out; });
  console.log('DENSITY ' + JSON.stringify(r));
  const at = (m: number) => r.find((x: any) => x.min >= m)?.alive ?? 0; expect(at(0.5)).toBeGreaterThan(35); expect(at(1)).toBeGreaterThan(70); expect(at(2)).toBeGreaterThan(120); expect(at(3)).toBeGreaterThan(200); expect(at(5)).toBeLessThanOrEqual(520); // cap 400 + surge slack
});
