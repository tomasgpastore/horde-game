import { test, expect } from '@playwright/test';
test('evolution card + elite drops chest -> level-up', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/?seed=2&bloom=0&nodegrade=1'); await page.click('button[data-a=play]'); await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const g = (window as any).__game, s = g.sim.state, p = s.players[0], e = s.enemies; g.paused = true; p.iframes = 1e9;
    const inp = { moveX: 0, moveZ: 0, aimX: 0, aimZ: 1, dash: false, ability: false };
    // evolution: weapon maxed + paired passive (Might)
    p.weapons[0].level = 8; p.stats.damageMult = 1.15; p.xp = p.xpToNext; g.sim.step([inp]);
    const offered = s.levelChoices.slice(); g.sim.choose(0);
    const evo = { offered, evolved: p.weapons[0].evolved, level: p.weapons[0].level, phase: s.phase };
    // elite: appears at t>=50; kill it next to the player => chest => level-up
    for (let i = 0; i < e.count; i++) e.alive[i] = 0; s.time = 50.01; g.sim.step([inp]);
    let ei = -1; for (let i = 0; i < e.count; i++) if (e.alive[i] && e.flags[i] & 1) ei = i;
    const hasElite = ei >= 0; if (ei >= 0) { e.hp[ei] = 0.01; e.x[ei] = p.x + 3; e.z[ei] = p.z; }
    let chest = false; for (let t = 0; t < 900 && s.phase === 'running'; t++) { g.sim.step([inp]); for (let i = 0; i < s.pickups.count; i++) if (s.pickups.alive[i] && s.pickups.kind[i] === 1) chest = true; }
    let ch = 0, cd = -1; for (let i = 0; i < s.pickups.count; i++) if (s.pickups.alive[i] && s.pickups.kind[i] === 1) { ch++; cd = Math.hypot(s.pickups.x[i] - p.x, s.pickups.z[i] - p.z); }
    return { evo, hasElite, chest, phase: s.phase, level: p.level, chestsLeft: ch, cd, px: p.xp, nx: p.xpToNext };
  });
  console.log('EVO ' + JSON.stringify(r));
  expect(r.evo.offered[0]).toBe('e:ember_bolt'); expect(r.evo.evolved).toBe(true); expect(r.evo.level).toBe(12);
  expect(r.hasElite).toBe(true); expect(r.chest).toBe(true); expect(r.phase).toBe('levelUp'); expect(errors).toEqual([]);
});
