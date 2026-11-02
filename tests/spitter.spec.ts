import { test, expect } from '@playwright/test';
test('spitter telegraphs then fires a dodgeable orb; wraith phases through obstacles', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/?seed=2&bloom=0&nodegrade=1'); await page.click('button[data-a=play]'); await page.waitForTimeout(500);
  const r = await page.evaluate(() => { const g = (window as any).__game, s = g.sim.state, p = s.players[0], e = s.enemies; g.paused = true; const inp = { moveX: 0, moveZ: 0, aimX: 0, aimZ: 1, dash: false, ability: false };
    for (let i = 0; i < e.count; i++) e.alive[i] = 0; p.stats.moveSpeed = 0; // stand still
    const i = e.count++; e.alive[i] = 1; e.kind[i] = 6; e.hp[i] = 9999; e.x[i] = p.x + 12; e.z[i] = p.z; e.flags[i] = 0;
    const evs = new Set<string>(); let shots = 0, hurt = 0, minD = 99; p.iframes = 0;
    for (let t = 0; t < 60 * 8; t++) { g.sim.step([inp]); for (const ev of s.events) { evs.add(ev.t); if (ev.t === 'playerHurt') hurt++; } for (let j = 0; j < s.projectiles.count; j++) if (s.projectiles.alive[j] && s.projectiles.kind[j] === 6) shots++; minD = Math.min(minD, Math.hypot(e.x[i] - p.x, e.z[i] - p.z)); p.hp = 100; }
    // wraith inside an obstacle ring: obstacles[0]
    const ob = g.sim.arena.obstacles[0]; const w = e.count++; e.alive[w] = 1; e.kind[w] = 7; e.hp[w] = 9999; e.x[w] = ob.x; e.z[w] = ob.z; e.flags[w] = 0; g.sim.step([inp]);
    const wd = Math.hypot(e.x[w] - ob.x, e.z[w] - ob.z);
    return { evs: [...evs], shots, hurt, minD, wraithPushedOut: wd > ob.r - 0.01 }; });
  console.log('SPIT ' + JSON.stringify(r));
  expect(r.evs).toContain('telegraph'); expect(r.shots).toBeGreaterThan(0); expect(r.hurt).toBeGreaterThan(0); expect(r.minD).toBeGreaterThan(8); expect(r.wraithPushedOut).toBe(false); expect(errors).toEqual([]);
});
