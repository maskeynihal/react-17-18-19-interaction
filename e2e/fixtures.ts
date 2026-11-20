import { test as base, expect, type ConsoleMessage, type Page } from '@playwright/test';

/** app19 origin in e2e (preview server). Only contacted in "remote" mode. */
export const APP19_ORIGIN = 'http://localhost:5190';
export const APP19_ENTRY = `${APP19_ORIGIN}/remoteEntry.js`;
const APP19_PORT = new URL(APP19_ORIGIN).port;

export type FeatureMode = 'bundled' | 'remote';

export interface FeatureFixtures {
  /** Per-project option (playwright.config.ts): how app19 features are loaded. */
  featureMode: FeatureMode;
}

export interface GuardOptions {
  /** Console `error` messages matching any of these are tolerated for this test. */
  allowedConsoleErrors: RegExp[];
}

export const test = base.extend<
  FeatureFixtures & GuardOptions & { consoleGuard: void; siblingRequests: string[]; remoteModeConfig: void }
>({
  featureMode: ['bundled', { option: true }],
  allowedConsoleErrors: [[], { option: true }],

  /**
   * Every test fails on console `error` or uncaught `pageerror` (AC7: duplicate React,
   * invalid hook call, unmount-during-render warnings, etc.).
   */
  consoleGuard: [
    async ({ page, allowedConsoleErrors }, use) => {
      const problems: string[] = [];
      const onConsole = (msg: ConsoleMessage) => {
        if (msg.type() !== 'error') return;
        const text = msg.text();
        if (allowedConsoleErrors.some((re) => re.test(text))) return;
        problems.push(`[console.error] ${text} @ ${msg.location().url}`);
      };
      const onPageError = (err: Error) => problems.push(`[pageerror] ${err.message}`);
      page.on('console', onConsole);
      page.on('pageerror', onPageError);
      await use();
      // let deferred (setTimeout 0) unmounts flush before checking
      await page.waitForTimeout(50).catch(() => {});
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      expect(problems, 'console errors / page errors').toEqual([]);
    },
    { auto: true },
  ],

  /**
   * ADR 0004: in bundled mode the portal must be standalone — records every request and fails the test if
   * any went to app19's port (5190), including requests a test aborted via page.route.
   */
  siblingRequests: [
    async ({ page, featureMode }, use) => {
      const hits: string[] = [];
      page.context().on('request', (req) => {
        try {
          if (new URL(req.url()).port === APP19_PORT) hits.push(req.url());
        } catch {
          /* data:, blob: etc. */
        }
      });
      await use(hits);
      if (featureMode === 'bundled') expect(hits, `requests to the sibling port :${APP19_PORT}`).toEqual([]);
    },
    { auto: true },
  ],

  /** Remote project: serve config.json in `"mode": "remote"`. Routes a test registers later take precedence. */
  remoteModeConfig: [
    async ({ page, featureMode }, use) => {
      if (featureMode === 'remote') {
        await page.route('**/config.json', (route) =>
          route.fulfill({ json: { mode: 'remote', remotes: { app19: APP19_ENTRY } } }),
        );
      }
      await use();
    },
    { auto: true },
  ],
});

export { expect };

export const shell = (page: Page) => page.locator('#root > [data-app-shell]');

/** Feature mode the portal resolved from /config.json at boot (<html data-feature-mode>). */
export async function expectFeatureMode(page: Page, mode: FeatureMode): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-feature-mode', mode);
}
