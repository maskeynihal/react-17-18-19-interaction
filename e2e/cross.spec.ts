import { test, expect, shellReactVersion, PORTAL17_ORIGIN } from './fixtures';

// Requires the react17-portal preview on :5170 (see README / PORTAL17_DIR).
test.describe('cross-import: app19 hosts portal17 (React 17)', { tag: '@cross' }, () => {
  test('/legacy/users renders portal17 UsersPage on React 17 inside a React 19 shell', async ({ page }) => {
    await page.goto('/legacy/users');
    const remote = page.locator('[data-remote="portal17/UsersPage"] [data-mfe="UsersPage"]');
    await expect(remote).toBeVisible();
    await expect(remote).toHaveAttribute('data-react-version', '17.0.2');
    expect(await shellReactVersion(page)).toMatch(/^19\./);
    await expect(page.getByTestId('remote-loading')).toHaveCount(0);
  });

  test('selecting a user calls host callback, emits mfe:user-selected and shows banner', async ({ page }) => {
    await page.goto('/legacy/users');
    await page.evaluate(() => {
      (window as unknown as { __selected: unknown[] }).__selected = [];
      window.addEventListener('mfe:user-selected', (e) =>
        (window as unknown as { __selected: unknown[] }).__selected.push((e as CustomEvent).detail),
      );
    });
    const row = page.locator('[data-mfe="UsersPage"]').getByTestId('user-row').first();
    const userId = await row.getAttribute('data-user-id');
    await row.click();

    const banner = page.getByTestId('selected-user');
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute('data-user-id', userId ?? '');
    // callback is called before the event is emitted (contract rule 4)
    await expect(banner).toHaveAttribute('data-via', 'callback');
    const selected = await page.evaluate(() => (window as unknown as { __selected: { id: string }[] }).__selected);
    expect(selected.map((u) => u.id)).toEqual([userId]);
    // host passes selectedUserId back down via update()
    await expect(row).toHaveAttribute('aria-selected', 'true');
  });

  test('dashboard embeds portal17 ProfileCard (React 17) for the current user', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-remote="portal17/ProfileCard"] [data-mfe="ProfileCard"]');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-react-version', '17.0.2');
    await expect(card.getByTestId('profile-card')).toHaveAttribute('data-user-id', 'u-1');
    expect(await shellReactVersion(page)).toMatch(/^19\./);
  });

  test('theme change propagates to the remote via update()', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-mfe="ProfileCard"]');
    await expect(card).toHaveAttribute('data-theme', 'light');
    await page.getByTestId('theme-toggle').click();
    await expect(card).toHaveAttribute('data-theme', 'dark');
  });

  test('navigating away unmounts the remote and removes its DOM', async ({ page }) => {
    await page.goto('/legacy/users');
    await expect(page.locator('[data-mfe="UsersPage"]')).toBeVisible();
    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page.getByTestId('dashboard')).toBeVisible();
    await expect(page.locator('[data-mfe="UsersPage"]')).toHaveCount(0);
    await expect(page.locator('[data-remote="portal17/UsersPage"]')).toHaveCount(0);
    // and back again: remounts cleanly from the cached module
    await page.getByRole('link', { name: 'Legacy users' }).click();
    await expect(page.locator('[data-mfe="UsersPage"]')).toHaveAttribute('data-react-version', '17.0.2');
    await expect(page.locator('[data-mfe="UsersPage"]')).toHaveCount(1);
  });

  test('remote failure shows fallback, rest of app works, retry recovers', async ({ page, consoleGuard }) => {
    consoleGuard.allow(/Failed to load resource: net::ERR_FAILED/);
    await page.route(`${PORTAL17_ORIGIN}/remoteEntry.js`, (route) => route.abort('failed'));
    await page.goto('/');

    const slot = page.getByTestId('profile-slot');
    await expect(slot.getByTestId('remote-error')).toBeVisible();
    await expect(page.getByTestId('kpi-total-value')).toHaveText('6');
    await page.getByRole('link', { name: 'Legacy users' }).click();
    await expect(page.getByTestId('remote-error')).toBeVisible();
    await expect(page.getByTestId('no-selected-user')).toBeVisible();
    await page.getByRole('link', { name: 'Dashboard' }).click();
    // a fresh mount retries the (evicted) load and fails again while the portal is still blocked
    await expect(slot.getByTestId('remote-error')).toBeVisible();

    await page.unroute(`${PORTAL17_ORIGIN}/remoteEntry.js`);
    await slot.getByTestId('remote-retry').click();
    await expect(slot.locator('[data-mfe="ProfileCard"]')).toHaveAttribute('data-react-version', '17.0.2');
    await expect(slot.getByTestId('remote-error')).toHaveCount(0);
  });

  test('runtime /config.json overrides the build-time remote URL (registerRemotes)', async ({ page, consoleGuard }) => {
    consoleGuard.allow(/Failed to load resource: net::ERR_CONNECTION_REFUSED/);
    const bogus = 'http://localhost:5999/remoteEntry.js';
    await page.route('**/config.json', (route) => route.fulfill({ json: { remotes: { portal17: bogus } } }));
    const requested = page.waitForRequest(bogus);
    await page.goto('/');
    await requested;
    await expect(page.getByTestId('profile-slot').getByTestId('remote-error')).toBeVisible();
  });

  test('documents behaviour: clicks inside the React 17 remote bubble to React 19 host onClick', async ({ page }) => {
    // ADR 0001: both React versions listen at their root container, and the remote's container is a DOM
    // descendant of the host's root, so the native click reaches the host root listener and React 19
    // dispatches the host ancestor's onClick. Remote authors and hosts must not assume isolation.
    await page.goto('/legacy/users');
    await expect(page.getByTestId('legacy-panel-clicks')).toHaveText('0');
    await page.locator('[data-mfe="UsersPage"]').getByTestId('user-row').first().click();
    await expect(page.getByTestId('selected-user')).toBeVisible();
    await expect(page.getByTestId('legacy-panel-clicks')).toHaveText('1');
  });
});
