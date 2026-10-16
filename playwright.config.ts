import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, timeout: 40000,
  use: { baseURL: 'http://localhost:3211', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: { command: process.env.E2E_COMPILED === '1' ? 'npm start' : 'npm run dev', url: 'http://localhost:3211/health', reuseExistingServer: false,
    env: { PORT: '3211', APP_ORIGIN: 'http://localhost:3211', HOST: '127.0.0.1', SQLITE_PATH: join(tmpdir(), `just-us-browser-test-${Date.now()}.sqlite`), NODE_ENV: 'test', DATABASE_URL: '' } },
});
