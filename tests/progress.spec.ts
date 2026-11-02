import { test, expect } from '@playwright/test';
import { watchErrors } from './helpers/errors';
// Personal bests / last-10 runs: finish synthetic runs through Game.gameOver and check records, events, persistence.
test('meta: personal bests, meta:best events, last 10 runs, persistence', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/'); await page.click('button[data-a=play]'); await page.waitForFunction(() => (window as any).__game?.sim.state.tick > 5, null, { timeout: 90000, polling: 250 });
  const out = await page.evaluate(() => {
    const g = (window as any).__game, ev: any[] = [], overs: any[] = [];
    addEventListener('meta:best', (e: any) => ev.push(e.detail)); addEventListener('game:over', (e: any) => overs.push(e.detail.records));
    g.meta.clear();
    const finish = (kills: number, time: number, level: number) => { const s = g.sim.state; s.kills = kills; s.time = time; s.players[0].level = level; g.gameOver(false); };
    finish(10, 60, 3); const first = overs.at(-1), evFirst = ev.length;
    finish(5, 90, 3); const second = overs.at(-1), evSecond = ev.slice(evFirst);
    for (let i = 0; i < 12; i++) finish(i, i, 1);
    let ro = true; try { g.meta.recent().push(1); (g.meta as any).last = null; } catch { ro = false; }
    return { first, evFirst, second, evSecond, recent: g.meta.recent().length, newest: g.meta.recent()[0].kills, bests: g.meta.bests(g.sim.arena.id), last: g.meta.last !== null, ro };
  });
  expect(out.first.first).toBe(true); expect(out.first.broken).toEqual([]); expect(out.evFirst).toBe(0);
  expect(out.second.broken).toEqual(['time']); expect(out.evSecond).toEqual([{ kind: 'time', value: 90, prev: 60, arena: out.second.arena }]);
  expect(out.recent).toBe(10); expect(out.newest).toBe(11); expect(out.bests.kills).toBe(11); expect(out.bests.runs).toBe(14); expect(out.last).toBe(true);
  // persisted across reload
  await page.reload(); await page.waitForFunction(() => (window as any).__game);
  const after = await page.evaluate(() => { const g = (window as any).__game; return { b: g.meta.bests('ashen_woods'), n: g.meta.recent().length }; });
  expect(after.b.time).toBe(90); expect(after.n).toBe(10);
  expect(errors).toEqual([]);
});
