import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * The portal is a separate repo. Point PORTAL17_DIR at its checkout (default: ../react17-portal).
 * Its preview server is only started when that directory exists, so `--grep-invert @cross`
 * runs without it. Cross tests (@cross) need it.
 */
const PORTAL17_DIR = resolve(process.env.PORTAL17_DIR ?? '../react17-portal');
const hasPortal = existsSync(resolve(PORTAL17_DIR, 'package.json'));
const reuseExistingServer = !process.env.CI;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  ...(process.env.SLOWMO ? { timeout: 120_000 } : {}),
  use: {
    baseURL: 'http://localhost:5190',
    trace: 'retain-on-failure',
    // SLOWMO=ms slows every action so a headed run can be watched (npm run test:e2e:watch)
    launchOptions: { slowMo: Number(process.env.SLOWMO ?? 0) },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run build && npm run preview',
      url: 'http://localhost:5190/remoteEntry.js',
      reuseExistingServer,
      timeout: 120_000,
    },
    ...(hasPortal
      ? [
          {
            command: 'npm run build && npm run preview',
            cwd: PORTAL17_DIR,
            url: 'http://localhost:5170/remoteEntry.js',
            reuseExistingServer,
            timeout: 120_000,
          },
        ]
      : []),
  ],
});
