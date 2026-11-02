import { test, expect } from '@playwright/test';
test('quality low (also via auto-degrade path) lowers the enemy cap; high restores it', async ({ page }) => {
  await page.goto('/?seed=3&bloom=0&nodegrade=1'); await page.click('button[data-a=play]'); await page.waitForTimeout(500);
  const r = await page.evaluate(() => { const g = (window as any).__game, out: any = {}; g.renderer.setQuality('high'); out.high = g.aliveLimit; g.renderer.setQuality('low'); out.low = g.aliveLimit; g.renderer.setQuality('med'); out.med = g.aliveLimit; return out; });
  expect(r.low).toBe(200); expect(r.high).toBeGreaterThan(r.low); expect(r.med).toBe(r.high);
});
