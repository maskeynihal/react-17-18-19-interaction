import { test, expect, blockPortal, shellReactVersion } from './fixtures';

// Standalone: the portal is deliberately unreachable so these run without the other repo.
test.describe('standalone app19', () => {
  test.beforeEach(async ({ page, consoleGuard }) => {
    await blockPortal(page, consoleGuard);
  });

  test('shell reports React 19 and dashboard shows KPIs', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('shell-title')).toHaveText(/New App · React 19\.\d+\.\d+/);
    expect(await shellReactVersion(page)).toMatch(/^19\./);

    await expect(page.getByTestId('kpi-total-value')).toHaveText('6');
    // 2 enterprise × 499 + 2 pro × 49 + 2 free × 0
    await expect(page.getByTestId('kpi-mrr-value')).toHaveText('$1,096');
    await expect(page.getByTestId('kpi-plan-free-value')).toHaveText('2');
    await expect(page.getByTestId('kpi-plan-pro-value')).toHaveText('2');
    await expect(page.getByTestId('kpi-plan-enterprise-value')).toHaveText('2');
    await expect(page.getByTestId('plan-chart')).toBeVisible();
    await expect(page.getByTestId('recent-customer-row')).toHaveCount(5);
  });

  test('portal down: ProfileCard slot shows fallback, rest of dashboard works', async ({ page }) => {
    await page.goto('/');
    const err = page.getByTestId('profile-slot').getByTestId('remote-error');
    await expect(err).toBeVisible();
    await expect(err).toHaveAttribute('role', 'alert');
    await expect(err.getByTestId('remote-retry')).toBeVisible();
    await expect(page.getByTestId('kpi-total-value')).toHaveText('6');
    await page.getByRole('link', { name: 'New customer' }).click();
    await expect(page.getByTestId('customer-form')).toBeVisible();
  });

  test('customer form shows validation errors', async ({ page }) => {
    await page.goto('/customers/new');
    await page.getByTestId('customer-name').fill('A');
    await page.getByTestId('customer-email').fill('not-an-email');
    await page.getByTestId('customer-submit').click();

    await expect(page.getByTestId('customer-name-error')).toBeVisible();
    await expect(page.getByTestId('customer-email-error')).toBeVisible();
    await expect(page.getByTestId('customer-plan-error')).toBeVisible();
    await expect(page.getByTestId('customer-name')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByTestId('customer-email')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByTestId('customer-plan')).toHaveAttribute('aria-invalid', 'true');
    // values survive the action round-trip
    await expect(page.getByTestId('customer-name')).toHaveValue('A');
    await expect(page.getByTestId('customer-success')).toHaveCount(0);
  });

  test('successful submit emits event and updates dashboard', async ({ page }) => {
    await page.goto('/customers/new');
    await page.evaluate(() => {
      (window as unknown as { __created: unknown[] }).__created = [];
      window.addEventListener('mfe:customer-created', (e) =>
        (window as unknown as { __created: unknown[] }).__created.push((e as CustomEvent).detail),
      );
    });
    await page.getByTestId('customer-name').fill('Hooli');
    await page.getByTestId('customer-email').fill('gavin@hooli.test');
    await page.getByTestId('customer-plan').selectOption('pro');
    await page.getByTestId('customer-submit').click();

    await expect(page.getByTestId('customer-success')).toContainText('Hooli');
    await expect(page.getByTestId('customer-name')).toHaveValue('');
    const created = await page.evaluate(() => (window as unknown as { __created: { name: string }[] }).__created);
    expect(created).toHaveLength(1);
    expect(created[0]?.name).toBe('Hooli');
    await expect(page.getByTestId('shell-customer-count')).toHaveText('7 customers');

    await page.getByTestId('back-to-dashboard').click();
    await expect(page.getByTestId('kpi-total-value')).toHaveText('7');
    await expect(page.getByTestId('kpi-mrr-value')).toHaveText('$1,145');
    await expect(page.getByTestId('recent-customers')).toContainText('Hooli');
  });

  test('exposes remoteEntry.js and public config.json', async ({ request }) => {
    const entry = await request.get('/remoteEntry.js');
    expect(entry.ok()).toBe(true);
    const config = await (await request.get('/config.json')).json();
    expect(config).toEqual({ remotes: { portal17: 'http://localhost:5170/remoteEntry.js' } });
  });
});
