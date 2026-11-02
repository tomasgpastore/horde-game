import { defineConfig } from '@playwright/test';
export default defineConfig({
  retries: (globalThis as any).process?.env?.CI ? 1 : 0, // one retry on CI for software-GL timing noise
  workers: 1, // software-GL tests are CPU-bound; parallel workers cause flaky timing
  testDir: 'tests', timeout: 60000,
  use: { baseURL: process.env.BASE_URL || 'http://127.0.0.1:4173', video: 'on', screenshot: 'on', launchOptions: { args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] } },
  webServer: process.env.BASE_URL ? undefined : { command: 'npm run build && npx vite preview --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: true, timeout: 120000 },
});
