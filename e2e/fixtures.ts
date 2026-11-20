import { test as base, expect, type Page } from '@playwright/test';

/** Origin of the portal17 remote in e2e (preview server). Only contacted in "remote" mode. */
export const PORTAL17_ORIGIN = 'http://localhost:5170';
export const PORTAL17_ENTRY = `${PORTAL17_ORIGIN}/remoteEntry.js`;
const PORTAL17_PORT = new URL(PORTAL17_ORIGIN).port;

export type FeatureMode = 'bundled' | 'remote';

export interface FeatureFixtures {
  /** Per-project option (playwright.config.ts): how portal17 features are loaded. */
  featureMode: FeatureMode;
}

interface ConsoleGuard {
  /** Allow console errors matching this pattern for the current test (e.g. deliberate network aborts). */
  allow(pattern: RegExp): void;
  readonly errors: string[];
}

/** Every request URL the page's context sent to the portal's port during the test. */
type SiblingRequests = string[];

export const test = base.extend<
  FeatureFixtures & { consoleGuard: ConsoleGuard; siblingRequests: SiblingRequests; remoteModeConfig: void }
>({
  featureMode: ['bundled', { option: true }],

  /**
   * Fails any test that logs a console `error` or throws a `pageerror` (AC7: duplicate React / invalid hook
   * call / unmount races all surface as console errors).
   */
  consoleGuard: [
    async ({ page }, use) => {
      const allowed: RegExp[] = [];
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(`[console.error] ${msg.text()} @ ${msg.location().url}`);
      });
      page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));
      const guard: ConsoleGuard = {
        allow: (p) => void allowed.push(p),
        get errors() {
          return errors;
        },
      };
      await use(guard);
      const unexpected = errors.filter((e) => !allowed.some((p) => p.test(e)));
      expect(unexpected, 'unexpected console errors / page errors').toEqual([]);
    },
    { auto: true },
  ],

  /**
   * ADR 0004: in bundled mode the app must be standalone — records every request and fails the test if any
   * went to the portal's port (5170), including requests that a test aborted via page.route.
   */
  siblingRequests: [
    async ({ page, featureMode }, use) => {
      const hits: SiblingRequests = [];
      page.context().on('request', (req) => {
        try {
          if (new URL(req.url()).port === PORTAL17_PORT) hits.push(req.url());
        } catch {
          /* data:, blob: etc. */
        }
      });
      await use(hits);
      if (featureMode === 'bundled') expect(hits, `requests to the sibling port :${PORTAL17_PORT}`).toEqual([]);
    },
    { auto: true },
  ],

  /** Remote project: serve config.json in `"mode": "remote"`. Routes a test registers later take precedence. */
  remoteModeConfig: [
    async ({ page, featureMode }, use) => {
      if (featureMode === 'remote') {
        await page.route('**/config.json', (route) =>
          route.fulfill({ json: { mode: 'remote', remotes: { portal17: PORTAL17_ENTRY } } }),
        );
      }
      await use();
    },
    { auto: true },
  ],
});

export { expect };

/** Make the portal17 origin unreachable and allow only the resulting network console error. */
export async function blockPortal(page: Page, guard: ConsoleGuard): Promise<void> {
  await page.route(`${PORTAL17_ORIGIN}/**`, (route) => route.abort('failed'));
  guard.allow(/Failed to load resource: net::ERR_FAILED/);
}

/** Shell React version (contract rule 8). */
export async function shellReactVersion(page: Page): Promise<string | null> {
  return page.locator('#root > [data-app-shell]').getAttribute('data-react-version');
}

/** Feature mode the app resolved from /config.json at boot (<html data-feature-mode>). */
export async function expectFeatureMode(page: Page, mode: FeatureMode): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-feature-mode', mode);
}
