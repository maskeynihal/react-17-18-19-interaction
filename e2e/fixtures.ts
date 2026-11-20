import { test as base, expect, type ConsoleMessage } from '@playwright/test';

export interface GuardOptions {
  /** Console `error` messages matching any of these are tolerated for this test. */
  allowedConsoleErrors: RegExp[];
}

/**
 * Every test fails on console `error` or uncaught `pageerror` (AC7: duplicate React,
 * invalid hook call, unmount-during-render warnings, etc.).
 */
export const test = base.extend<GuardOptions & { consoleGuard: void }>({
  allowedConsoleErrors: [[], { option: true }],
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
});

export { expect };

export const shell = (page: import('@playwright/test').Page) => page.locator('#root > [data-app-shell]');
