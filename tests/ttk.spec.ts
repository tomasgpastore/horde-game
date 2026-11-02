import { test } from '@playwright/test';
// Time-to-kill per boss: invulnerable kiting bot with smart card picks plays the whole biome chain; logs spawn->death seconds per boss.
// card picks use the live ?autoplay=1 rule (g.botPick)
test('ttk per boss', async ({ page }) => {
  test.setTimeout(500000);
  await page.goto('/?bloom=0&nodegrade=1'); await page.click('button[data-a=play]'); await page.waitForTimeout(500);
  const out: any[] = [];
  for (const seed of [1, 2, 3]) {
    out.push(await page.evaluate((seed) => { const g = (window as any).__game; g.paused = true; g.reset(seed); const s = g.sim.state, p = s.players[0]; const pri = (id: string) => id.startsWith('e:') ? 0 : id.startsWith('w:') ? 1 : id === 'p:hp' ? 2 : 3;
      const ttk: Record<string, number[]> = {}; let cur: { id: string; t: number } | null = null; let lvlAt: Record<string, number> = {};
      for (let t = 0; t < 60 * 1500 && s.phase !== 'gameOver'; t++) { p.iframes = 1e9;
        if (s.phase === 'levelUp') { g.choose(g.botPick()); continue; }
        g.sim.step([g.bot(p)]); g.onSimEvents(s.events);
        if (s.boss && !cur) { cur = { id: s.boss.id, t: s.time }; lvlAt[cur.id] = p.level; }
        if (!s.boss && cur) { (ttk[cur.id] ??= []).push(Math.round(s.time - cur.t)); cur = null; } }
      return { seed, ttk, lvlAt, end: Math.round(s.time), victory: s.phase === 'gameOver' }; }, seed));
  }
  console.log('TTK ' + JSON.stringify(out));
});
