import { test, expect } from '@playwright/test';
import { watchErrors } from './helpers/errors';

// Balance harness + sim perf. Steps the sim directly (no rendering) in the page's V8.
// Bot = Game.bot (kites), NOT invulnerable, so we see whether a real player-ish bot survives 5 min. Cards auto-picked (index = tick%3).
for (const god of [false, true]) test(`balance: 5 simulated minutes (${god ? 'invulnerable bot' : 'mortal bot'})`, async ({ page }, info) => {
  const errors = watchErrors(page);
  await page.goto('/?bloom=0&seed=1337');
  await page.waitForFunction(() => !!(window as any).__game);
  const res = await page.evaluate((god) => {
    const g = (window as any).__game, sim = g.sim, s = sim.state, rows: any[] = [];
    let msAcc = 0, ticks = 0, lastKills = 0, died = -1, maxMs = 0;
    for (let t = 0; t < 60 * 60 * 5; t++) {
      if (s.phase === 'levelUp') sim.choose(s.tick % 3);
      if (s.phase === 'gameOver') { died = s.time; break; }
      if (god) s.players[0].iframes = 9999;
      const inp = g.bot(s.players[0]); const t0 = performance.now(); sim.step([inp]); const d = performance.now() - t0;
      msAcc += d; ticks++; if (d > maxMs) maxMs = d;
      if (s.tick % 3600 === 0) { const p = s.players[0]; let alive = 0; for (let i = 0; i < s.enemies.count; i++) alive += s.enemies.alive[i];
        rows.push({ min: s.tick / 3600, kills: s.kills, killsInMin: s.kills - lastKills, lvl: p.level, hp: Math.round(p.hp), alive, wave: s.wave, msTick: +(msAcc / ticks).toFixed(3), weapons: p.weapons.map((w: any) => w.id + w.level).join(',') });
        lastKills = s.kills; msAcc = 0; ticks = 0; }
    }
    return { rows, died, maxMs: +maxMs.toFixed(2), phase: s.phase, simTime: +s.time.toFixed(1) };
  }, god);
  console.log(`BALANCE god=${god} ` + JSON.stringify(res));
  await info.attach(`balance-${god}.json`, { body: JSON.stringify(res, null, 1), contentType: 'application/json' });
  const k = res.rows.map((r: any) => r.killsInMin);
  if (res.died >= 0) console.log(`BALANCE WARN: player died at ${res.died.toFixed(1)}s`);
  if (k.length >= 3 && k[k.length - 1] <= k[0]) console.log('BALANCE WARN: kills/min flat or falling (bored?)', k);
  expect(res.rows.length + (res.died >= 0 ? 1 : 0)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('sim perf: ms/tick at 400 enemies + 4 weapons', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?bloom=0&seed=99');
  await page.waitForFunction(() => !!(window as any).__game);
  const res = await page.evaluate(() => {
    const g = (window as any).__game, sim = g.sim, s = sim.state, p = s.players[0], e = s.enemies;
    p.hp = p.maxHp = 1e9; p.iframes = 1e9;
    p.weapons = ['ember_bolt', 'orbit_blades', 'frost_nova', 'chain_lightning'].map(id => ({ id, level: 5, cooldown: 0 }));
    const fill = () => { let alive = 0; for (let i = 0; i < e.count; i++) alive += e.alive[i];
      for (let i = 0; alive < 400 && i < 2048; i++) { if (i < e.count && e.alive[i]) continue; const a = i * 2.399, r = 4 + (i % 25) * 0.8;
        e.alive[i] = 1; e.kind[i] = i % 3; e.x[i] = p.x + Math.cos(a) * r; e.z[i] = p.z + Math.sin(a) * r; e.hp[i] = 40; e.vx[i] = e.vz[i] = 0; if (i >= e.count) e.count = i + 1; alive++; } };
    const per: Record<string, number> = {}; const N = 600, times: number[] = [];
    for (let t = 0; t < N + 120; t++) {
      if (t % 30 === 0) fill(); // keep ~400 alive as weapons kill them
      if (s.phase === 'levelUp') sim.choose(0);
      const inp = { moveX: Math.cos(t / 90), moveZ: Math.sin(t / 90), aimX: 1, aimZ: 0, dash: false, ability: false };
      if (t < 120) { sim.step([inp]); continue; } // warmup (JIT)
      const t0 = performance.now(); s.events.length = 0; const ctx = { dt: 1 / 60, rng: sim.rng, arena: sim.arena, inputs: [inp] };
      for (const sys of sim.systems) { const a = performance.now(); sys.update(s, ctx); per[sys.name] = (per[sys.name] || 0) + (performance.now() - a); }
      s.tick++; times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b); let alive = 0; for (let i = 0; i < e.count; i++) alive += e.alive[i];
    return { avgMs: +(times.reduce((a, b) => a + b, 0) / N).toFixed(3), p95Ms: +times[Math.floor(N * .95)].toFixed(3), maxMs: +times[N - 1].toFixed(3), alive,
      perSystemMs: Object.fromEntries(Object.entries(per).map(([k, v]) => [k, +(v / N).toFixed(3)]).sort((a: any, b: any) => b[1] - a[1])) };
  });
  console.log('SIMPERF ' + JSON.stringify(res));
  if (res.avgMs >= 4) console.log('SIMPERF WARN: avg >= 4ms budget');
  expect(res.avgMs).toBeLessThan(4);
  expect(errors).toEqual([]);
});
