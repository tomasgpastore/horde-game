import type { Page } from '@playwright/test';
// Console-error gate: collect page errors + console errors (ignoring known-benign GPU noise).
const IGNORE = [/GPU stall due to ReadPixels/i, /GL Driver Message/i, /favicon/i];
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e)));
  page.on('console', m => { if (m.type() === 'error' && !IGNORE.some(r => r.test(m.text()))) errors.push('console: ' + m.text()); });
  page.on('requestfailed', r => { if (!/favicon/.test(r.url())) errors.push('requestfailed: ' + r.url()); });
  return errors;
}
