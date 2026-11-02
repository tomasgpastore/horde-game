import { test, expect } from '@playwright/test';
const hook = (page: any) => page.waitForFunction(() => (window as any).__audio, null, { timeout: 15000 });

test('audio unlocks on first real click and title music starts', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/'); await hook(page);
  const before = await page.evaluate(() => { const a = (window as any).__audio.audio; return a.ctx ? a.ctx.state : 'none'; });
  expect(before).not.toBe('running'); // no sound before a user gesture (autoplay policy)
  await page.click('button[data-a=settings]'); // any real click is the first gesture
  await page.waitForFunction(() => (window as any).__audio.audio.ctx?.state === 'running', null, { timeout: 5000 });
  await page.waitForFunction(() => (window as any).__audio.music.current === 'title', null, { timeout: 5000 });
  expect(errors).toEqual([]);
});

test('audio unlocks on first keypress', async ({ page }) => {
  await page.goto('/'); await hook(page);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => (window as any).__audio.audio.ctx?.state === 'running', null, { timeout: 5000 });
});

test('boss / hurt / dash / death paths fire sounds, switch theme, no errors', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?autoplay=1'); await hook(page); await page.click('button[data-a=play]');
  await page.waitForFunction(() => (window as any).__game?.sim?.state?.tick > 30);
  await page.evaluate(() => { const w = window as any, s = w.__audio.sfx, o = s.play.bind(s); w.T = {}; s.play = (n: string, p: any) => { w.T[n] = (w.T[n] || 0) + 1; return o(n, p); }; });
  const emit = (ev: any[]) => page.evaluate((ev) => { const g = (window as any).__game; g.audio.consume(ev, g.sim.state); }, ev);
  await page.waitForFunction(() => (window as any).__audio.music.current === 'battle', null, { timeout: 8000 });
  await emit([{ t: 'playerHurt', id: 0, dmg: 5 }, { t: 'dash', id: 0 }]);
  await emit([{ t: 'bossSpawn', x: 0, z: 0, bossId: 'b' }]);
  const duck = await page.evaluate(() => (window as any).__audio.audio.musicDuck.gain.value);
  await page.waitForFunction(() => (window as any).__audio.music.current === 'boss', null, { timeout: 8000 });
  await emit([{ t: 'bossDeath', x: 0, z: 0, bossId: 'b' }]);
  await page.waitForFunction(() => (window as any).__audio.music.current === 'battle', null, { timeout: 8000 });
  await emit([{ t: 'gameOver', victory: false }]);
  const T = await page.evaluate(() => (window as any).T);
  expect(T.hurt).toBeGreaterThan(0); expect(T.dash).toBeGreaterThan(0); expect(T.boss_telegraph).toBeGreaterThan(0);
  expect(T.boss_roar).toBeGreaterThan(0); expect(T.levelup).toBeGreaterThan(0); expect(T.death).toBeGreaterThan(0);
  expect(duck).toBeLessThan(1); // telegraph ducks the music right after bossSpawn
  expect(errors).toEqual([]);
});

test('menu buttons fire UI sounds + stinger via real clicks; freeze is hit-stop, evolve plays sting', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?autoplay=1'); await hook(page);
  await page.evaluate(() => { const w = window as any, s = w.__audio.sfx, o = s.play.bind(s); w.T = {}; s.play = (n: string, p: any) => { w.T[n] = (w.T[n] || 0) + 1; return o(n, p); }; });
  await page.click('button[data-a=settings]'); // first gesture: unlock (+ click sfx)
  await page.waitForFunction(() => (window as any).__audio.audio.ctx?.state === 'running');
  await page.locator('button[data-a=back]:visible').click();
  await page.hover('button[data-a=credits]'); await page.click('button[data-a=credits]'); await page.locator('button[data-a=back]:visible').click();
  await page.click('button[data-a=play]');
  await page.waitForFunction(() => (window as any).__game?.sim?.state?.tick > 30);
  const emit = (ev: any[]) => page.evaluate((ev) => { const g = (window as any).__game; g.audio.consume(ev, g.sim.state); }, ev);
  const U = await page.evaluate(() => (window as any).T);
  expect(U.ui_hover).toBeGreaterThan(0); expect(U.ui_click).toBeGreaterThan(0); expect(U.ui_back).toBeGreaterThan(0); expect(U.stinger).toBeGreaterThan(0);
  await page.evaluate(() => { (window as any).T = {}; });
  await emit([{ t: 'freeze', ms: 120 }, { t: 'slow', scale: 0.3, secs: 0.4 }]);
  await emit([{ t: 'evolve', id: 0, weapon: 'ember_bolt' }]);
  const T = await page.evaluate(() => (window as any).T);
  expect(T.freeze).toBeUndefined();          // hit-stop must not trigger the ice tick
  expect(T.evolve).toBeGreaterThan(0);       // evolve sting
  expect(T.levelup).toBeUndefined();
  expect(errors).toEqual([]);
});

test('M hotkey toggles mute in game, not while typing', async ({ page }) => {
  await page.goto('/'); await hook(page);
  await page.click('button[data-a=settings]'); await page.locator('button[data-a=back]:visible').click();
  const muted = () => page.evaluate(() => (window as any).__audio.audio.isMuted);
  expect(await muted()).toBe(false);
  await page.keyboard.press('KeyM'); expect(await muted()).toBe(true);
  await page.keyboard.press('KeyM'); expect(await muted()).toBe(false);
  await page.evaluate(() => { const i = document.createElement('input'); i.id = 'tmp'; document.body.appendChild(i); i.focus(); });
  await page.keyboard.press('KeyM'); expect(await muted()).toBe(false); // typing in an input: ignored
});

test('real boss telegraph/slam events trigger boss_telegraph / boss_slam', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?autoplay=1&t=298'); await hook(page); await page.click('button[data-a=play]');
  await page.waitForFunction(() => (window as any).__game?.sim?.state?.tick > 30);
  await page.evaluate(() => { const w = window as any, s = w.__audio.sfx, o = s.play.bind(s); w.T = {}; s.play = (n: string, p: any) => { w.T[n] = (w.T[n] || 0) + 1; return o(n, p); }; });
  // wait for the sim itself to emit them (boss spawns at 300s, then chase -> telegraph -> charge -> slam)
  await page.waitForFunction(() => { const T = (window as any).T; return T.boss_telegraph >= 2 && T.boss_slam >= 1; }, null, { timeout: 40000 });
  expect(errors).toEqual([]);
});
