import { test, expect } from '@playwright/test';
import { watchErrors } from './helpers/errors';

// Spawns N enemies directly into the pool and measures frame time. SwiftShader is slow: compare relative numbers (baseline vs 300 vs 1000).
for (const n of [0, 300, 1000]) {
  test(`perf with ${n} enemies`, async ({ page }, info) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/'); await page.click('button[data-a=play]'); await page.waitForTimeout(2500);
    await page.evaluate((n) => {
      const g = (window as any).__game, s = g.sim.state, e = s.enemies, p = s.players[0];
      p.hp = p.maxHp = 1e9; // survive so we measure rendering, not death screen
      for (let i = 0; i < n; i++) { const a = i * 2.399, r = 6 + (i % 40) * 0.5;
        e.alive[i] = 1; e.kind[i] = 0; e.x[i] = p.x + Math.cos(a) * r; e.z[i] = p.z + Math.sin(a) * r; e.hp[i] = 1e6; }
      if (n > e.count) e.count = n;
    }, n);
    await page.waitForTimeout(1000);
    const res = await page.evaluate(() => new Promise<any>(res => {
      const g = (window as any).__game; const ft: number[] = []; let last = performance.now(); const t0 = last;
      const tick = (now: number) => { ft.push(now - last); last = now; if (now - t0 < 5000) requestAnimationFrame(tick); else {
        ft.shift(); const s = [...ft].sort((a, b) => a - b), avg = ft.reduce((a, b) => a + b, 0) / ft.length;
        const info = g.renderer?.three?.info?.render;
        res({ frames: ft.length, avgMs: +avg.toFixed(1), p95Ms: +s[Math.floor(s.length * .95)].toFixed(1), maxMs: +s[s.length - 1].toFixed(1), drawCalls: info?.calls ?? null, tris: info?.triangles ?? null }); } };
      requestAnimationFrame(tick);
    }));
    const enemies = await page.evaluate(() => (window as any).__game.sim.state.enemies.count);
    console.log(`PERF n=${n} enemies=${enemies} ` + JSON.stringify(res));
    await info.attach('perf.json', { body: JSON.stringify({ n, ...res }), contentType: 'application/json' });
    await page.screenshot({ path: info.outputPath(`perf-${n}.png`) });
    expect(res.frames).toBeGreaterThan(5);
    expect(errors).toEqual([]);
  });
}
