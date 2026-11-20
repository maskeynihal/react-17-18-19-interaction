import { test, expect, shell, expectFeatureMode, APP19_ENTRY } from './fixtures';

// @cross: run in the default "bundled" project (app19 features from @mfe/app19-features, no app19 server)
// and, with REMOTE=1, again in the "remote" project (runtime federation from app19 on :5190).
// @remote: transport-specific (remoteEntry.js fetch / config.json URL override) — remote mode only.
// Selectors inside remotes ([data-testid=stats-widget-value], kpi-total-value, customer-*)
// come from react19-app's exposed components.

const REACT19 = /^19\./;

test.describe('portal17 hosting app19 @cross', () => {
  test('/dashboard renders R19 DashboardPage inside the R17 shell with host customers', async ({ page, featureMode, siblingRequests }) => {
    await page.goto('/dashboard');
    await expectFeatureMode(page, featureMode);
    const remote = page.locator('[data-remote="app19/DashboardPage"] > [data-mfe="DashboardPage"]');
    await expect(remote).toBeVisible();
    await expect(remote).toHaveAttribute('data-react-version', REACT19);
    await expect(remote).toHaveAttribute('data-theme', 'light');
    await expect(shell(page)).toHaveAttribute('data-react-version', '17.0.2');
    await expect(page.getByTestId('customer-count')).toHaveText('6');
    await expect(remote.getByTestId('kpi-total-value')).toHaveText('6');
    await expect(page.getByTestId('remote-loading')).toHaveCount(0);
    // bundled: nothing from :5190 (also enforced by the fixture); remote: loaded via app19's remoteEntry.js
    if (featureMode === 'remote') expect(siblingRequests).toContain(APP19_ENTRY);
    else expect(siblingRequests).toEqual([]);
  });

  test('host theme prop reaches the remote via update()', async ({ page }) => {
    await page.goto('/dashboard');
    const remote = page.locator('[data-mfe="DashboardPage"]');
    await expect(remote).toHaveAttribute('data-theme', 'light');
    await page.getByTestId('theme-toggle').click();
    await expect(remote).toHaveAttribute('data-theme', 'dark');
  });

  test('/customers/new: R19 validation, then submit adds to host store, toast, count, redirect', async ({ page }) => {
    await page.goto('/customers/new');
    const remote = page.locator('[data-mfe="CustomerFormPage"]');
    await expect(remote).toHaveAttribute('data-react-version', REACT19);

    await remote.getByTestId('customer-submit').click();
    await expect(remote.getByTestId('customer-name-error')).toBeVisible();
    await expect(remote.getByTestId('customer-email-error')).toBeVisible();
    await expect(remote.getByTestId('customer-plan-error')).toBeVisible();
    await expect(page.getByTestId('customer-count')).toHaveText('6');

    await remote.getByTestId('customer-name').fill('Wayne Enterprises');
    await remote.getByTestId('customer-email').fill('bruce@wayne.test');
    await remote.getByTestId('customer-plan').selectOption('enterprise');
    await remote.getByTestId('customer-submit').click();

    await expect(page.getByTestId('toast')).toContainText('Wayne Enterprises');
    await expect(page).toHaveURL(/\/dashboard$/);
    // onSubmit + mfe:customer-created both fire; dedupe by id keeps it at +1
    await expect(page.getByTestId('customer-count')).toHaveText('7');
    const dashboard = page.locator('[data-mfe="DashboardPage"]');
    await expect(dashboard.getByTestId('kpi-total-value')).toHaveText('7');
    await expect(dashboard.getByTestId('recent-customers')).toContainText('Wayne Enterprises');
    await expect(page.locator('[data-mfe="CustomerFormPage"]')).toHaveCount(0);
  });

  test('home: two R19 StatsWidgets; bump button pushes new props through update()', async ({ page }) => {
    await page.goto('/');
    const widgets = page.locator('[data-mfe="StatsWidget"]');
    await expect(widgets).toHaveCount(2);
    for (const w of await widgets.all()) await expect(w).toHaveAttribute('data-react-version', REACT19);

    const customers = page.getByTestId('widget-customers').getByTestId('stats-widget-value');
    const revenue = page.getByTestId('widget-revenue').getByTestId('stats-widget-value');
    await expect(customers).toHaveText('6');
    await expect(revenue).toHaveText('12,500');

    // Same mounted root must be updated, not re-mounted.
    await revenue.evaluate((el) => ((el as HTMLElement & { __marker?: number }).__marker = 1));
    await page.getByTestId('bump').click();
    await expect(revenue).toHaveText('13,500');
    expect(await revenue.evaluate((el) => (el as HTMLElement & { __marker?: number }).__marker)).toBe(1);
  });

  test('navigating away unmounts remote roots and removes their DOM', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('[data-mfe="DashboardPage"]')).toBeVisible();
    await page.getByRole('link', { name: 'Users' }).click();
    await expect(page.getByTestId('users-table')).toBeVisible();
    await expect(page.locator('[data-mfe]')).toHaveCount(0);
    await expect(page.locator('[data-remote]')).toHaveCount(0);

    // and back again: fresh mount works (module promise cached)
    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page.locator('[data-mfe="DashboardPage"]')).toHaveAttribute('data-react-version', REACT19);
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page.locator('[data-mfe="StatsWidget"]')).toHaveCount(2);
    await expect(page.locator('[data-mfe="DashboardPage"]')).toHaveCount(0);
    // fixture asserts: no console errors (e.g. unmount-during-render warnings)
  });

  test('click inside a React 19 remote bubbles to the React 17 host ancestor (documented behaviour)', async ({ page }) => {
    // ADR 0001: both React versions listen at their root container, so a native click inside the
    // remote bubbles up the DOM and the host's synthetic onClick on an ancestor fires too.
    await page.goto('/');
    await expect(page.locator('[data-mfe="StatsWidget"]')).toHaveCount(2);
    await expect(page.getByTestId('host-clicks')).toHaveText('0');
    await page.getByTestId('widget-revenue').getByTestId('stats-widget-value').click();
    await expect(page.getByTestId('host-clicks')).toHaveText('1');
  });
});

test.describe('app19 remoteEntry unavailable @remote', () => {
  test.use({
    // Chrome logs the aborted request; nothing else may log.
    allowedConsoleErrors: [/Failed to load resource/],
  });

  test('aborted remoteEntry shows remote-error fallback; shell keeps working; retry recovers', async ({ page }) => {
    let block = true;
    await page.route('**://localhost:5190/remoteEntry.js', (route) => (block ? route.abort() : route.continue()));

    await page.goto('/dashboard');
    const error = page.getByTestId('remote-error');
    await expect(error).toBeVisible();
    await expect(error).toHaveAttribute('role', 'alert');
    await expect(error).toContainText('app19/DashboardPage');
    await expect(shell(page)).toHaveAttribute('data-react-version', '17.0.2');
    await expect(page.getByTestId('customer-count')).toHaveText('6');

    // header/nav still work
    await page.getByRole('link', { name: 'Users' }).click();
    await expect(page.getByTestId('users-table')).toBeVisible();
    await page.getByTestId('users-search').fill('bob');
    await expect(page.getByTestId('user-row')).toHaveCount(1);

    // retry after the remote comes back
    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page.getByTestId('remote-error')).toBeVisible();
    block = false;
    await page.getByTestId('remote-retry').click();
    await expect(page.locator('[data-mfe="DashboardPage"]')).toHaveAttribute('data-react-version', REACT19);
    await expect(page.getByTestId('remote-error')).toHaveCount(0);
  });
});

test.describe('runtime remote config (ADR 0002) @remote', () => {
  test.use({ allowedConsoleErrors: [/Failed to load resource/] });

  test('config.json override wins over the build-time default', async ({ page }) => {
    const entries: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('remoteEntry.js')) entries.push(r.url());
    });
    await page.route('**/config.json', (r) =>
      r.fulfill({ json: { mode: 'remote', remotes: { app19: 'http://localhost:5999/remoteEntry.js' } } }),
    );
    await page.goto('/dashboard');
    await expect(page.getByTestId('remote-error')).toBeVisible();
    expect(entries.some((u) => u.startsWith('http://localhost:5999/remoteEntry.js'))).toBe(true);
    expect(entries.filter((u) => u.includes(':5190/'))).toEqual([]);
  });

  test('remote mode without remotes uses the build-time default app19 URL', async ({ page }) => {
    await page.route('**/config.json', (r) => r.fulfill({ json: { mode: 'remote' } }));
    await page.goto('/dashboard');
    await expect(page.locator('[data-mfe="DashboardPage"]')).toHaveAttribute('data-react-version', REACT19);
  });
});

// Bundled-mode analogue of "app19 remoteEntry unavailable" (runs in the "bundled" project only): the
// feature's code-split chunk from @mfe/app19-features fails to load → fallback; Retry re-imports it.
test.describe('bundled feature chunk failure (mode "bundled")', () => {
  test.use({ allowedConsoleErrors: [/Failed to load resource/] });

  test('chunk load failure shows remote-error fallback; shell keeps working; retry recovers', async ({ page, featureMode }) => {
    test.skip(featureMode !== 'bundled', 'bundled mode only');
    let block = true;
    await page.route('**/assets/DashboardPage-*.js', (route) => (block ? route.abort() : route.continue()));

    await page.goto('/dashboard');
    const error = page.getByTestId('remote-error');
    await expect(error).toBeVisible();
    await expect(error).toHaveAttribute('role', 'alert');
    await expect(error).toContainText('app19/DashboardPage');
    await expect(shell(page)).toHaveAttribute('data-react-version', '17.0.2');
    await expect(page.getByTestId('customer-count')).toHaveText('6');

    await page.getByRole('link', { name: 'Users' }).click();
    await expect(page.getByTestId('users-table')).toBeVisible();

    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page.getByTestId('remote-error')).toBeVisible();
    block = false;
    await page.getByTestId('remote-retry').click();
    await expect(page.locator('[data-mfe="DashboardPage"]')).toHaveAttribute('data-react-version', REACT19);
    await expect(page.getByTestId('remote-error')).toHaveCount(0);
  });
});
