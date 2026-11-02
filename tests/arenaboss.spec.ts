import { test } from '@playwright/test';
for (const arena of ['drowned_cathedral', 'void_garden', 'ashen_woods'])
test('boss spawns when run starts in ' + arena, async ({ page }) => {
  await page.goto(`/?arena=${arena}&bloom=0&nodegrade=1`); await page.click('button[data-a=play]'); await page.waitForTimeout(500);
  const r = await page.evaluate(() => { const g = (window as any).__game; g.paused = true; g.reset(3); const s = g.sim.state, p = s.players[0]; let bossT = -1;
    for (let t = 0; t < 60 * 330 && s.phase !== 'gameOver'; t++) { p.iframes = 1e9; if (s.phase === 'levelUp') { g.choose(0); continue; } g.sim.step([g.bot(p)]); g.onSimEvents(s.events); if (s.boss && bossT < 0) bossT = Math.round(s.time); }
    return { arena: g.sim.arena.id, bossT, biomeT0: s.biomeT0 }; });
  console.log('AB ' + JSON.stringify(r));
});
