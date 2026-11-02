import { test, expect } from '@playwright/test';
// Core progression: a bot that picks only 'e: > owned-weapon upgrade > paired passive > other' must reach an EVOLUTION via card offers alone.
test('weapon upgrade cards are offered and an evolution is reachable by picking upgrades', async ({ page }, info) => {
  test.setTimeout(120000);
  await page.goto('/?seed=5&bloom=0&nodegrade=1'); await page.click('button[data-a=play]'); await page.waitForTimeout(500);
  const r = await page.evaluate(() => { const g = (window as any).__game, s = g.sim.state, p = s.players[0]; g.paused = true; p.iframes = 1e9; const inp = { moveX: 0, moveZ: 0, aimX: 0, aimZ: 1, dash: false, ability: false };
    const PAIR: any = { ember_bolt: 'p:might', orbit_blades: 'p:area', frost_nova: 'p:haste', chain_lightning: 'p:luck', lava_trail: 'p:armor', seeker_spears: 'p:speed' };
    const owned = () => p.weapons.map((w: any) => w.id); let picks = 0, upgradeOffers = 0, offers = 0, evolvedAt = -1; const log: string[] = [];
    for (let i = 0; i < 60 && evolvedAt < 0; i++) { p.xp = p.xpToNext; for (let k = 0; k < 3 && s.phase !== 'levelUp'; k++) { g.sim.step([inp]); g.onSimEvents(s.events); } if (s.phase !== 'levelUp') break;
      const ch: string[] = s.levelChoices; offers++; if (ch.some(c => c.startsWith('w:') && owned().includes(c.slice(2)))) upgradeOffers++;
      const rank = (c: string) => c.startsWith('e:') ? 0 : (c.startsWith('w:') && owned().includes(c.slice(2))) ? 1 : owned().some((w: string) => PAIR[w] === c) ? 2 : 3;
      let b = 0; ch.forEach((c, j) => { if (rank(c) < rank(ch[b])) b = j; }); log.push(ch[b]); if (ch[b].startsWith('e:')) evolvedAt = picks; g.sim.choose(b); picks++; }
    return { evolvedAt, offers, upgradeOffers, picks, log: log.join(' ') }; });
  console.log('PROG ' + JSON.stringify(r));
  expect(r.evolvedAt).toBeGreaterThan(0); expect(r.evolvedAt).toBeLessThan(30); expect(r.upgradeOffers).toBeGreaterThanOrEqual(Math.floor(r.offers * 0.5)); // slot is offered in ~75% of offers (+ random upgrade draws)
  const evoShot = await page.evaluate(() => { const g = (window as any).__game, s = g.sim.state; g.paused = false; g.running = false; return s.players[0].weapons.map((w: any) => w.id + ':' + w.level + (w.evolved ? '*' : '')).join(','); }); console.log('BUILD ' + evoShot);
  await page.waitForTimeout(3000); await page.screenshot({ path: '/tmp/shot-progression.png' });
});
