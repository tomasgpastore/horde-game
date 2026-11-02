import { test, expect, devices } from '@playwright/test';
// Portrait phone UI: HUD must not overlap, level-up cards must fit the viewport, key hints hidden on touch.
test('mobile portrait: HUD + level-up cards fit 390x844', async ({ browser }, info) => {
  test.setTimeout(120000);
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 664 }, baseURL: (info.project.use as any).baseURL }); const page = await ctx.newPage();
  await page.goto('/?seed=3&bloom=0&nodegrade=1'); await page.waitForSelector('button[data-a=play]', { timeout: 60000 }); await page.tap('button[data-a=play]');
  await page.waitForFunction(() => (window as any).__game?.sim.state.tick > 90, null, { timeout: 60000 }); await page.waitForTimeout(800);
  await page.screenshot({ path: info.outputPath('hud.png') });
  const hud = await page.evaluate(() => { const r = (sel: string) => { const e = document.querySelector(sel) as HTMLElement | null; if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; }; return { time: r('.tb-time'), hp: r('.tb-hp'), lv: r('.tb-lv'), kills: r('.tb-kills') }; });
  const ov = (a: any, b: any) => a && b && a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
  console.log('HUD ' + JSON.stringify(hud));
  await page.evaluate(() => { const g = (window as any).__game, p = g.sim.state.players[0]; p.xp = p.xpToNext; });
  await page.waitForFunction(() => (window as any).__game.sim.state.phase === 'levelUp', null, { timeout: 30000 }); await page.waitForTimeout(900);
  await page.screenshot({ path: info.outputPath('cards.png') });
  const cards = await page.evaluate(() => Array.from(document.querySelectorAll('.card')).map(c => { const b = (c as HTMLElement).getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), hint: /Press \d/.test((c as HTMLElement).innerText) }; }));
  console.log('CARDS ' + JSON.stringify(cards));
  expect(ov(hud.time, hud.hp)).toBeFalsy(); expect(ov(hud.time, hud.lv)).toBeFalsy();
  for (const c of cards) { expect(c.l).toBeGreaterThanOrEqual(0); expect(c.r).toBeLessThanOrEqual(390); expect(c.b).toBeLessThanOrEqual(664); expect(c.hint).toBe(false); }
  await ctx.close();
});
