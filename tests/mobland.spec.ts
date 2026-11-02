import { test, devices } from '@playwright/test';
test('landscape phone cards', async ({ browser }, info) => {
  test.setTimeout(90000);
  const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'], baseURL: (info.project.use as any).baseURL }); const page = await ctx.newPage();
  await page.goto('/?seed=3&bloom=0&nodegrade=1'); await page.waitForSelector('button[data-a=play]'); await page.tap('button[data-a=play]');
  await page.waitForFunction(() => (window as any).__game?.sim.state.tick > 90, null, { timeout: 60000 });
  await page.evaluate(() => { const g = (window as any).__game, p = g.sim.state.players[0]; p.xp = p.xpToNext; });
  await page.waitForFunction(() => (window as any).__game.sim.state.phase === 'levelUp', null, { timeout: 30000 }); await page.waitForTimeout(900);
  console.log('VP ' + JSON.stringify(page.viewportSize()) + ' ' + JSON.stringify(await page.evaluate(() => Array.from(document.querySelectorAll('.card')).map(c => { const b = (c as HTMLElement).getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right), Math.round(b.top), Math.round(b.bottom)]; }))));
  const ov = await page.evaluate(() => { const r = (q: string) => (document.querySelector(q) as HTMLElement).getBoundingClientRect(); const a = r('.tb-time'), b = r('.tb-hp'); return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; });
  console.log('OVERLAP ' + ov); if (ov) throw new Error('timer overlaps HP bar');
  await page.screenshot({ path: '/tmp/land.png' }); await ctx.close(); });
