import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests', timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:4173', video: 'on', screenshot: 'on', launchOptions: { args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] } },
  webServer: { command: 'npm run build && npx vite preview --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: true, timeout: 120000 },
});
