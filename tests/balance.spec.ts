import { test } from '@playwright/test';
// Arena: BAL_ARENA=drowned_cathedral npx playwright test tests/balance.spec.ts (default ashen_woods).
// Balance guard: non-invulnerable kiting bot with smart card picks, 10 seeds, up to 15 sim-minutes each. Prints survival stats.
test('balance: bot survival over 10 seeds', async ({ page }) => {
  test.setTimeout(1500000);
  const arena = (globalThis as any).process?.env?.BAL_ARENA as string | undefined;
  await page.goto('/?bloom=0&nodegrade=1' + (arena ? `&arena=${encodeURIComponent(arena)}` : '')); await page.click('button[data-a=play]'); await page.waitForTimeout(500);
  const runs: any[] = [];
  for (let seed = 1; seed <= 10; seed++) {
    runs.push(await page.evaluate((seed) => { const g = (window as any).__game; g.paused = true; g.reset(seed); const s = g.sim.state, p = s.players[0]; let boss = 0; const enter: number[] = []; let lastBiome = 0;
      const pri = (id: string) => id.startsWith('e:') ? 0 : id.startsWith('w:') ? 1 : id === 'p:hp' ? 2 : id === 'p:armor' ? 2 : 3;
      const limit = 900; let t90hp = -1;
      while (s.time < limit && s.phase !== 'gameOver') {
        if (s.phase === 'levelUp') { let b = 0; s.levelChoices.forEach((id: string, i: number) => { if (pri(id) < pri(s.levelChoices[b])) b = i; }); g.choose(b); continue; }
        g.sim.step([g.bot(p)]); g.onSimEvents(s.events); if (s.boss) boss = 1; if (s.biome !== lastBiome) { lastBiome = s.biome; enter.push(Math.round(s.time)); } if (t90hp < 0 && s.time >= 90) t90hp = Math.round(p.hp);
      }
      return { seed, enter, biome: s.biome, won: s.phase === 'gameOver' && p.hp > 0, died: s.phase === 'gameOver', t: +s.time.toFixed(0), kills: s.kills, lvl: p.level, boss, hpAt90: t90hp }; }, seed));
  }
  const ts = runs.map(r => r.t).sort((a, b) => a - b), q = (f: number) => ts[Math.min(ts.length - 1, Math.floor(ts.length * f))], med = q(0.5);
  const limit = 900; // keep in sync with the in-page loop
  const hist: Record<string, number> = {}; for (const r of runs) { const b = r.died ? `${Math.floor(r.t / 60)}:00-${Math.floor(r.t / 60)}:59` : `survived ${limit}s`; hist[b] = (hist[b] ?? 0) + 1; }
  console.log('HIST ' + JSON.stringify(hist));
  console.log('BALANCE ' + JSON.stringify({ arena: arena ?? 'default', median_survival_s: med, p25_s: q(0.25), p75_s: q(0.75), survivedAll: runs.filter(r => !r.died).length, survived90: runs.filter(r => r.t >= 90).length, reached300: runs.filter(r => r.t >= 300).length, bossSeen: runs.filter(r => r.boss).length, biomeEnterTimes: runs.map(r => r.enter), runs }));
});
