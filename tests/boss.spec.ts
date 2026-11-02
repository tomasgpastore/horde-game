import { test, expect } from '@playwright/test';
test('boss spawns, telegraphs, charges, dies -> reward card (biome chain: see biomes.spec)', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/?seed=9&bloom=0'); await page.click('button[data-a=play]'); await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const g = (window as any).__game; g.paused = true; const s = g.sim.state, p = s.players[0]; p.iframes = 1e9; s.time = 299.99; // World's spawner emits bossSpawn at t=300 on ashen_woods
    const inp = { moveX: 0, moveZ: 0, aimX: 0, aimZ: 1, dash: false, ability: false }; for (let i = 0; i < 5 && !s.boss; i++) g.sim.step([inp]);
    const modes = new Set<number>(); let hp0 = s.boss && s.enemies.hp[s.boss.idx];
    const evs = new Set<string>(); for (let i = 0; i < 600 && s.boss; i++) { g.sim.step([inp]); for (const e of s.events) evs.add(e.t); modes.add(s.boss?.mode ?? -1); }
    const had = !!s.boss; if (s.boss) s.enemies.alive[s.boss.idx] = 0; g.sim.step([inp]); g.sim.step([inp]);
    return { had, hp0, modes: [...modes], evs: [...evs], phase: s.phase, ev: s.events.map((e: any) => e.t) };
  });
  console.log(JSON.stringify(r)); expect(r.had).toBe(true); expect(r.modes).toContain(2); expect(r.evs).toContain('bossTelegraph'); expect(r.evs).toContain('bossSlam'); expect(r.phase).toBe('levelUp'); expect(errors).toEqual([]);
});
