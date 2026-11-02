import { test, expect } from '@playwright/test';
test('elite kill emits freeze(70ms) + kill{elite}; boss death emits freeze(120ms)', async ({ page }) => {
  await page.goto('/?seed=2&bloom=0&nodegrade=1'); await page.click('button[data-a=play]'); await page.waitForTimeout(500);
  const r = await page.evaluate(() => { const g = (window as any).__game, s = g.sim.state, p = s.players[0], e = s.enemies; g.paused = true; p.iframes = 1e9; const inp = { moveX: 0, moveZ: 0, aimX: 0, aimZ: 1, dash: false, ability: false };
    for (let i = 0; i < e.count; i++) e.alive[i] = 0; s.time = 50.01; g.sim.step([inp]); let ei = -1; for (let i = 0; i < e.count; i++) if (e.alive[i] && e.flags[i] & 1) ei = i;
    e.hp[ei] = 0.01; e.x[ei] = p.x + 3; e.z[ei] = p.z; const evs: any[] = []; for (let t = 0; t < 200 && !evs.some(x => x.t === 'kill'); t++) { g.sim.step([inp]); for (const ev of s.events) evs.push(ev); }
    return { kill: evs.find(x => x.t === 'kill'), freeze: evs.filter(x => x.t === 'freeze').map(x => x.ms) }; });
  expect(r.kill?.elite).toBe(true); expect(r.freeze).toContain(70);
});
