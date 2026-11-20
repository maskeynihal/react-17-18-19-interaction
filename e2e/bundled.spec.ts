import { test, expect, shell, expectFeatureMode } from './fixtures';

// ADR 0004 default mode: app19 features are imported from @mfe/app19-features (React 19 bundled in).
// Runs only in the "bundled" project; the auto fixture additionally fails on any request to :5190.
const REACT19 = /^19\./;
const OWN_ORIGIN = 'http://localhost:5170';

test.describe('bundled feature package (standalone, no app19 server)', () => {
  test('every embed route renders React 19 features with zero requests to the app19 port', async ({ page, siblingRequests }) => {
    const scripts: string[] = [];
    page.on('request', (r) => {
      if (r.resourceType() === 'script') scripts.push(r.url());
    });

    await page.goto('/');
    await expectFeatureMode(page, 'bundled');
    await expect(shell(page)).toHaveAttribute('data-react-version', '17.0.2');
    const widgets = page.locator('[data-remote="app19/StatsWidget"] > [data-mfe="StatsWidget"]');
    await expect(widgets).toHaveCount(2);
    for (const w of await widgets.all()) await expect(w).toHaveAttribute('data-react-version', REACT19);
    // CSS is injected by the package module itself (scoped .r19-*), no stylesheet link needed.
    await expect(page.locator('style#mfe-app19-features-css')).toHaveCount(1);

    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page.locator('[data-remote="app19/DashboardPage"] > [data-mfe="DashboardPage"]')).toHaveAttribute(
      'data-react-version',
      REACT19,
    );

    await page.goto('/customers/new');
    await expect(page.locator('[data-remote="app19/CustomerFormPage"] > [data-mfe="CustomerFormPage"]')).toHaveAttribute(
      'data-react-version',
      REACT19,
    );
    await expect(shell(page)).toHaveAttribute('data-react-version', '17.0.2');
    await expect(page.locator('style#mfe-app19-features-css')).toHaveCount(1);

    expect(siblingRequests).toEqual([]);
    // Every script (incl. the bundled React 19 chunk) comes from the portal's own origin.
    expect(scripts.filter((u) => new URL(u).origin !== OWN_ORIGIN)).toEqual([]);
  });

  test.describe('config.json fallbacks', () => {
    test.use({ allowedConsoleErrors: [/Failed to load resource: the server responded with a status of 404/] });
    for (const [name, fulfill] of [
      ['404', { status: 404, body: 'nope' }],
      ['empty object', { json: {} }],
      ['invalid JSON', { status: 200, contentType: 'application/json', body: '{not json' }],
    ] as const) {
      test(`config.json ${name} falls back to bundled mode`, async ({ page }) => {
        await page.route('**/config.json', (r) => r.fulfill(fulfill));
        await page.goto('/dashboard');
        await expectFeatureMode(page, 'bundled');
        await expect(page.locator('[data-mfe="DashboardPage"]')).toHaveAttribute('data-react-version', REACT19);
      });
    }
  });
});
