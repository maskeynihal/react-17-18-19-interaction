import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import type { FeatureFixtures } from './e2e/fixtures';

/**
 * Default (ADR 0004): only the portal is started. app19 features come from the bundled
 * @mfe/app19-features package, every @cross test runs in "bundled" mode and an auto fixture fails any
 * test that sends a request to app19's port (5190).
 *
 * REMOTE=1 additionally starts the react19-app preview (SIBLING_DIR, default ../react19-app) and adds the
 * "remote" project: config.json is routed to `"mode": "remote"` (runtime Module Federation) and the
 * @cross + @remote tests run against the live app19.
 */
const REMOTE = !!process.env.REMOTE;
const SIBLING_DIR = resolve(process.env.SIBLING_DIR ?? process.env.APP19_DIR ?? '../react19-app');
if (REMOTE && !existsSync(resolve(SIBLING_DIR, 'package.json'))) {
  throw new Error(`REMOTE=1 needs the react19-app checkout at SIBLING_DIR (${SIBLING_DIR})`);
}
const reuse = !process.env.CI;

export default defineConfig<FeatureFixtures>({
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
  projects: [
    // Everything except remote-only tests, in the default bundled mode; the sibling port must stay untouched.
    { name: 'bundled', grepInvert: /@remote/, use: { ...devices['Desktop Chrome'], featureMode: 'bundled' } },
    ...(REMOTE
      ? [{ name: 'remote', grep: /@cross|@remote/, use: { ...devices['Desktop Chrome'], featureMode: 'remote' as const } }]
      : []),
  ],
  webServer: [
    {
      command: 'npm run build && npm run preview',
      url: 'http://localhost:5170',
      reuseExistingServer: reuse,
      timeout: 120_000,
    },
    ...(REMOTE
      ? [
          {
            command: 'npm run build && npm run preview',
            cwd: SIBLING_DIR,
            url: 'http://localhost:5190/remoteEntry.js',
            reuseExistingServer: reuse,
            timeout: 180_000,
          },
        ]
      : []),
  ],
});
