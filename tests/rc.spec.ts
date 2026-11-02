import { test, expect, devices } from '@playwright/test';
// RELEASE-CANDIDATE pass. Run against any build: BASE_URL=https://emberhorde.fly.dev npx playwright test rc
const errs = (page: any) => { const e: string[] = []; page.on('pageerror', (x: any) => e.push(String(x))); page.on('console', (m: any) => m.type() === 'error' && !/favicon|404/.test(m.text()) && e.push(m.text())); return e; };

test('RC1 desktop: title → PLAY → run → death → results → RETRY (+ mute, quality low)', async ({ page }, info) => {
  test.setTimeout(150000); const e = errs(page);
  await page.goto('/'); await page.waitForSelector('button[data-a=play]', { timeout: 60000 }); await page.waitForTimeout(1500); await page.screenshot({ path: info.outputPath('1-title.png') });
  await page.click('button[data-a=play]'); await page.waitForFunction(() => (window as any).__game?.sim.state.tick > 120, null, { timeout: 90000 });
  await page.keyboard.press('KeyM'); await page.waitForTimeout(300); await page.keyboard.press('KeyM'); // mute toggle (no throw)
  await page.evaluate(() => (window as any).__game.applySettings({ ...(window as any).__game.settings, quality: 'low', qualityPref: 'low' }));
  const lim = await page.evaluate(() => (window as any).__game.aliveLimit); expect(lim).toBeLessThanOrEqual(200);
  await page.waitForTimeout(3000); await page.screenshot({ path: info.outputPath('2-play-low.png') });
  await page.evaluate(() => { const g = (window as any).__game; for (let k = 0; k < 5 && g.sim.state.phase === 'levelUp'; k++) g.choose(0); }); // resolve any pending level-up card first
  await page.evaluate(() => { const g = (window as any).__game, s = g.sim.state, p = s.players[0], en = s.enemies; p.hp = 1; p.iframes = 0; const i = en.count++; en.alive[i] = 1; en.kind[i] = 2; en.flags[i] = 0; en.hp[i] = 1e9; en.x[i] = p.x; en.z[i] = p.z; });
  await page.waitForFunction(() => { const el = document.querySelector('.results.defeat') as HTMLElement | null; return !!el && el.offsetParent !== null; }, null, { timeout: 60000 }); await page.waitForTimeout(1500); await page.screenshot({ path: info.outputPath('3-results.png') });
  await page.click('button[data-a=retry]'); await page.waitForFunction(() => { const s = (window as any).__game?.sim.state; return s && s.time < 25 && s.players[0].hp > 30 && s.phase !== 'gameOver' && (window as any).__game.running; }, null, { timeout: 60000 });
  await page.waitForTimeout(2000); await page.screenshot({ path: info.outputPath('4-retry.png') });
  expect(e).toEqual([]);
});

for (const [arena, id] of [['drowned_cathedral', 'Cathedral'], ['void_garden', 'Void']] as const)
test(`RC2 arena ${arena} loads and plays`, async ({ page }, info) => {
  test.setTimeout(120000); const e = errs(page);
  await page.goto(`/?arena=${arena}&t=60&autoplay=1`); await page.waitForSelector('button[data-a=play]', { timeout: 60000 }); await page.click('button[data-a=play]');
  await page.waitForFunction((a) => (window as any).__game?.sim.arena.id === a && (window as any).__game.sim.state.time > 60, arena, { timeout: 90000 }); await page.waitForTimeout(3000);
  await page.screenshot({ path: info.outputPath(`arena-${id}.png`) }); expect(e).toEqual([]);
});

test('RC3 mobile 390x844 touch', async ({ browser }, info) => {
  test.setTimeout(120000);
  const ctx = await browser.newContext({ ...devices['Pixel 5'], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, baseURL: (info.project.use as any).baseURL }); const page = await ctx.newPage(); const e = errs(page);
  await page.goto('/'); await page.waitForSelector('button[data-a=play]', { timeout: 60000 }); await page.waitForTimeout(1500); await page.screenshot({ path: info.outputPath('m1-title.png') });
  await page.tap('button[data-a=play]'); await page.waitForFunction(() => (window as any).__game?.sim.state.tick > 120, null, { timeout: 90000 }); await page.waitForTimeout(2500);
  const hasStick = await page.evaluate(() => !!document.querySelector('#stick')); await page.screenshot({ path: info.outputPath('m2-play.png') });
  expect(hasStick).toBe(true);
  await page.evaluate(() => { const g = (window as any).__game; for (let k = 0; k < 5 && g.sim.state.phase === 'levelUp'; k++) g.choose(0); const s = g.sim.state, p = s.players[0], en = s.enemies; p.hp = 1; p.iframes = 0; const i = en.count++; en.alive[i] = 1; en.kind[i] = 2; en.flags[i] = 0; en.hp[i] = 1e9; en.x[i] = p.x; en.z[i] = p.z; });
  await page.waitForFunction(() => { const el = document.querySelector('.results.defeat') as HTMLElement | null; return !!el && el.offsetParent !== null; }, null, { timeout: 60000 }); await page.waitForTimeout(1500);
  const box = await page.evaluate(() => { const b = (document.querySelector('.results.defeat') as HTMLElement).getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, txt: (document.querySelector('.results.defeat') as HTMLElement).innerText.slice(0, 40) }; });
  await page.screenshot({ path: info.outputPath('m3-results.png') }); expect(box.l).toBeGreaterThanOrEqual(0); expect(box.r).toBeLessThanOrEqual(390.5); expect(box.txt).toContain('YOU FELL'); // results card fits a 390-wide screen
  expect(e).toEqual([]); await ctx.close();
});
