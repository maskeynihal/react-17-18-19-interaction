import { test as base, expect, type Page } from '@playwright/test';

/** Origin of the portal17 remote in e2e (preview server). */
export const PORTAL17_ORIGIN = 'http://localhost:5170';
export const PORTAL17_ENTRY = `${PORTAL17_ORIGIN}/remoteEntry.js`;

interface ConsoleGuard {
  /** Allow console errors matching this pattern for the current test (e.g. deliberate network aborts). */
  allow(pattern: RegExp): void;
  readonly errors: string[];
}

/**
 * Fails any test that logs a console `error` or throws a `pageerror` (AC7: duplicate React / invalid hook
 * call / unmount races all surface as console errors).
 */
export const test = base.extend<{ consoleGuard: ConsoleGuard }>({
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
});

export { expect };

/** Make the portal17 remote unreachable and allow only the resulting network console error. */
export async function blockPortal(page: Page, guard: ConsoleGuard): Promise<void> {
  await page.route(`${PORTAL17_ORIGIN}/**`, (route) => route.abort('failed'));
  guard.allow(/Failed to load resource: net::ERR_FAILED/);
}

/** Shell React version (contract rule 8). */
export async function shellReactVersion(page: Page): Promise<string | null> {
  return page.locator('#root > [data-app-shell]').getAttribute('data-react-version');
}
