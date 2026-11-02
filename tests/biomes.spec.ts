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
      const card = document.body.innerText.toLowerCase().includes('entering') ? (document.body.innerText.match(/ENTERING[\s\S]{0,80}/i)?.[0] ?? '').replace(/\s+/g, ' ') : null;
      return { start, bossId, cards, phase, pend, card, after: { arena: g.sim.arena.id, rendered: g.renderer.arenaId, phase: s.phase, t: Math.round(s.time), biome: s.biome, bossFlag: s.spawner.boss } }; });
    log.push(r); console.log('BIOME ' + JSON.stringify(r));
    if (k < 2) { await page.evaluate(() => { (window as any).__game.paused = false; (window as any).__game.running = false; }); await page.waitForTimeout(1200); await page.screenshot({ path: `/tmp/biome_${k}.png` }); await page.evaluate(() => { (window as any).__game.paused = true; (window as any).__game.running = true; }); }
  }
  expect(log.map(l => l.bossId)).toEqual(['hollow_stag', 'bell_warden', 'the_unlit']);
  expect(log[0].card).toMatch(/drowned cathedral/i); expect(log[1].card).toMatch(/void garden/i);
  expect(log[0].card).toMatch(/biome 2 of 3/i); expect(log[1].card).toMatch(/biome 3 of 3/i); // number = arena's index in [ashen_woods, drowned_cathedral, void_garden] // real-browser DOM: 'Entering …' title card is shown on each swap
  expect(log[0].after.arena).toBe('drowned_cathedral'); expect(log[0].after.rendered).toBe('drowned_cathedral');
  expect(log[1].after.arena).toBe('void_garden'); expect(log[2].after.phase).toBe('gameOver'); expect(errors).toEqual([]);
});

// Reward card between biomes: boss dies -> level-up card screen shown (not auto-picked) -> screenshot for docs/art.
test('boss reward card is shown between biomes (screenshot)', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/?seed=9&bloom=0&nodegrade=1'); await page.click('button[data-a=play]'); await page.waitForTimeout(500);
  await page.evaluate(() => { const g = (window as any).__game, s = g.sim.state, p = s.players[0]; g.paused = true; p.iframes = 1e9; s.time = 299.99; const inp = { moveX: 0, moveZ: 0, aimX: 0, aimZ: 1, dash: false, ability: false };
    for (let i = 0; i < 5 && !s.boss; i++) { g.sim.step([inp]); g.onSimEvents(s.events); }
    for (let k = 0; k < 4; k++) { p.weapons[0].level = 8; }                       // a maxed weapon + Might so the evolution card can appear
    p.stats.damageMult = 1.15; s.enemies.alive[s.boss.idx] = 0; for (let i = 0; i < 5 && s.phase === 'running'; i++) { g.sim.step([inp]); g.onSimEvents(s.events); }
    g.paused = false; g.running = false; });                                       // render frames, keep the card on screen (no auto-pick)
  await page.waitForFunction(() => document.querySelectorAll('.card').length === 3, null, { timeout: 30000 }); await page.waitForTimeout(1200);
  const info = await page.evaluate(() => ({ phase: (window as any).__game.sim.state.phase, choices: (window as any).__game.sim.state.levelChoices, hp: (window as any).__game.sim.state.players[0].hp }));
  console.log('REWARD ' + JSON.stringify(info));
  await page.screenshot({ path: '/tmp/boss-reward-card.png' });
  expect(info.phase).toBe('levelUp'); expect(info.choices[0]).toBe('e:ember_bolt'); // evolution offered first (max level + Might)
});
