import { defineConfig, devices } from '@playwright/test';

const APP19_DIR = process.env.APP19_DIR ?? '../react19-app';
// APP19=0 skips starting the sibling app (use with --grep-invert @cross).
const withApp19 = process.env.APP19 !== '0';
const reuse = !process.env.CI;

export default defineConfig({
  // Explicit: infra/ (CDK, owned separately) has its own *.test.ts files.
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  ...(process.env.SLOWMO ? { timeout: 120_000 } : {}),
  use: {
    baseURL: 'http://localhost:5170',
    trace: 'retain-on-failure',
    // SLOWMO=ms slows every action so a headed run can be watched (npm run test:e2e:watch)
    launchOptions: { slowMo: Number(process.env.SLOWMO ?? 0) },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run build && npm run preview',
      url: 'http://localhost:5170',
      reuseExistingServer: reuse,
      timeout: 120_000,
    },
    ...(withApp19
      ? [
          {
            command: 'npm run build && npm run preview',
            cwd: APP19_DIR,
            url: 'http://localhost:5190/remoteEntry.js',
            reuseExistingServer: reuse,
            timeout: 180_000,
          },
        ]
      : []),
  ],
});
