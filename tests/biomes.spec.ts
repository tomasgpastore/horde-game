import { test, expect } from '@playwright/test';
// Chain: kill Hollow Stag -> reward card -> Drowned Cathedral -> kill Bell-Warden -> Void Garden -> kill The Unlit -> victory.
test('biome chain: 3 bosses, 3 arenas, victory only after The Unlit', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/?seed=9&bloom=0&nodegrade=1'); await page.click('button[data-a=play]'); await page.waitForTimeout(500);
  const log: any[] = [];
  for (let k = 0; k < 3; k++) {
    const r = await page.evaluate(() => { const g = (window as any).__game, s = g.sim.state, p = s.players[0]; g.paused = true; const inp = { moveX: 0, moveZ: 0, aimX: 0, aimZ: 1, dash: false, ability: false };
      const start = { arena: g.sim.arena.id, rendered: g.renderer.arenaId };
      p.iframes = 1e9; let guard = 0; while (!s.boss && guard++ < 60 * 400) { if (s.phase === 'levelUp') { g.choose(0); continue; } g.sim.step([g.bot(p)]); g.onSimEvents(s.events); }
      const bossId = s.boss?.id; s.enemies.alive[s.boss.idx] = 0; let i = 0; while (s.phase === 'running' && i++ < 5) { g.sim.step([inp]); g.onSimEvents(s.events); }
      const cards = s.levelChoices.slice(), phase = s.phase, pend = g.pendingBiome; if (s.phase === 'levelUp') g.choose(0);
      return { start, bossId, cards, phase, pend, after: { arena: g.sim.arena.id, rendered: g.renderer.arenaId, phase: s.phase, t: Math.round(s.time), biome: s.biome, bossFlag: s.spawner.boss } }; });
    log.push(r); console.log('BIOME ' + JSON.stringify(r));
    if (k < 2) { await page.evaluate(() => { (window as any).__game.paused = false; (window as any).__game.running = false; }); await page.waitForTimeout(1200); await page.screenshot({ path: `/tmp/biome_${k}.png` }); await page.evaluate(() => { (window as any).__game.paused = true; (window as any).__game.running = true; }); }
  }
  expect(log.map(l => l.bossId)).toEqual(['hollow_stag', 'bell_warden', 'the_unlit']);
  expect(log[0].after.arena).toBe('drowned_cathedral'); expect(log[0].after.rendered).toBe('drowned_cathedral');
  expect(log[1].after.arena).toBe('void_garden'); expect(log[2].after.phase).toBe('gameOver'); expect(errors).toEqual([]);
});
