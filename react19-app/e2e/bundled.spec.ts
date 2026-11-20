import { test, expect, shellReactVersion, expectFeatureMode } from './fixtures';

// ADR 0004 default mode: portal17 features are imported from @mfe/portal17-features (React 17 bundled in).
// Runs only in the "bundled" project; the auto fixture additionally fails on any request to :5170.
test.describe('bundled feature package (standalone, no portal server)', () => {
  test('every embed route renders React 17 features with zero requests to the portal port', async ({ page, siblingRequests }) => {
    const ownOrigin = 'http://localhost:5190';
    const scripts: string[] = [];
    page.on('request', (r) => {
      if (r.resourceType() === 'script') scripts.push(r.url());
    });

    await page.goto('/');
    await expectFeatureMode(page, 'bundled');
    const card = page.locator('[data-remote="portal17/ProfileCard"] [data-mfe="ProfileCard"]');
    await expect(card).toHaveAttribute('data-react-version', '17.0.2');
    expect(await shellReactVersion(page)).toMatch(/^19\./);
    // CSS is injected by the package module itself (scoped .r17-*), no stylesheet link needed.
    await expect(page.locator('style#mfe-portal17-features-css')).toHaveCount(1);

    await page.getByRole('link', { name: 'Legacy users' }).click();
    const users = page.locator('[data-remote="portal17/UsersPage"] [data-mfe="UsersPage"]');
    await expect(users).toHaveAttribute('data-react-version', '17.0.2');
    await expect(page.locator('style#mfe-portal17-features-css')).toHaveCount(1);

    expect(siblingRequests).toEqual([]);
    // Every script (incl. the bundled React 17 chunk) comes from this app's own origin.
    expect(scripts.filter((u) => new URL(u).origin !== ownOrigin)).toEqual([]);
  });

  for (const [name, fulfill] of [
    ['404', { status: 404, body: 'nope' }],
    ['without mode', { json: { remotes: { portal17: 'http://localhost:5170/remoteEntry.js' } } }],
    ['invalid JSON', { status: 200, contentType: 'application/json', body: '{not json' }],
  ] as const) {
    test(`config.json ${name} falls back to bundled mode`, async ({ page, consoleGuard }) => {
      consoleGuard.allow(/Failed to load resource: the server responded with a status of 404/);
      await page.route('**/config.json', (r) => r.fulfill(fulfill));
      await page.goto('/');
      await expectFeatureMode(page, 'bundled');
      await expect(page.locator('[data-mfe="ProfileCard"]')).toHaveAttribute('data-react-version', '17.0.2');
    });
  }
});
