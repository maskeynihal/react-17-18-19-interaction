import { test, expect, shell } from './fixtures';

test.describe('portal standalone (no app19 needed)', () => {
  test('shell reports React 17.0.2 and customer count', async ({ page }) => {
    await page.goto('/users');
    await expect(shell(page)).toHaveAttribute('data-react-version', '17.0.2');
    await expect(page.getByTestId('shell-title')).toHaveText('Main Portal · React 17.0.2');
    await expect(page.getByTestId('customer-count')).toHaveText('6');
    expect(await page.evaluate(() => window.__APP_REACT_VERSION__)).toBe('17.0.2');
  });

  test('users: search filters the table', async ({ page }) => {
    await page.goto('/users');
    const rows = page.getByTestId('user-row');
    await expect(rows).toHaveCount(8);
    await page.getByTestId('users-search').fill('admin');
    await expect(rows).toHaveCount(2);
    await page.getByTestId('users-search').fill('grace');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Grace Hopper');
    await page.getByTestId('users-search').fill('zzz');
    await expect(rows).toHaveCount(0);
    await expect(page.getByTestId('users-empty')).toBeVisible();
  });

  test('users: selecting a row highlights it and emits mfe:user-selected', async ({ page }) => {
    await page.goto('/users');
    await page.evaluate(() => {
      (window as unknown as { __selected: unknown[] }).__selected = [];
      window.addEventListener('mfe:user-selected', (e) =>
        (window as unknown as { __selected: unknown[] }).__selected.push((e as CustomEvent).detail),
      );
    });
    const row = page.locator('[data-testid="user-row"][data-user-id="u-3"]');
    await row.click();
    await expect(row).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-testid="user-row"][aria-selected="true"]')).toHaveCount(1);
    await expect(page.getByTestId('selected-user')).toHaveText('Selected: Carol Diaz');
    await expect(page.getByTestId('profile-card')).toHaveAttribute('data-user-id', 'u-3');
    const events = await page.evaluate(() => (window as unknown as { __selected: unknown[] }).__selected);
    expect(events).toEqual([{ id: 'u-3', name: 'Carol Diaz', email: 'carol@portal.test', role: 'viewer' }]);
  });

  test('profile form: validation errors then successful save', async ({ page }) => {
    await page.goto('/profile');
    const name = page.getByLabel('Full name');
    const email = page.getByLabel('Email');
    await name.fill('');
    await email.fill('not-an-email');
    await page.getByLabel('Role').selectOption('');
    await page.getByTestId('profile-save').click();
    await expect(page.getByTestId('error-name')).toHaveText('Name is required');
    await expect(page.getByTestId('error-email')).toHaveText('Enter a valid email address');
    await expect(page.getByTestId('error-role')).toHaveText('Select a role');
    await expect(page.getByTestId('profile-saved')).toHaveCount(0);

    // errors update live once the form has been touched
    await name.fill('A');
    await expect(page.getByTestId('error-name')).toHaveText('Name must be at least 2 characters');

    await name.fill('Alice Cooper');
    await email.fill('alice.cooper@portal.test');
    await page.getByLabel('Role').selectOption('editor');
    await page.getByTestId('profile-save').click();
    await expect(page.getByTestId('profile-saved')).toBeVisible();
    await expect(page.locator('[data-testid^="error-"]')).toHaveCount(0);
    await expect(page.getByTestId('profile-card-name')).toHaveText('Alice Cooper');
  });

  test('nav works between own pages', async ({ page }) => {
    await page.goto('/profile');
    await page.getByRole('link', { name: 'Users' }).click();
    await expect(page).toHaveURL(/\/users$/);
    await expect(page.getByTestId('users-table')).toBeVisible();
  });

  test('runtime config: /config.json is fetched and served', async ({ request }) => {
    const res = await request.get('/config.json');
    expect(res.ok()).toBeTruthy();
    expect(await res.json()).toEqual({ mode: 'bundled', remotes: { app19: 'http://localhost:5190/remoteEntry.js' } });
  });

  test('exposes ./UsersPage and ./ProfileCard in remoteEntry.js', async ({ request }) => {
    const body = await (await request.get('/remoteEntry.js')).text();
    expect(body).toContain('"./UsersPage"');
    expect(body).toContain('"./ProfileCard"');
  });

  test('exposed mount adapters render with React 17 and unmount cleanly', async ({ page }) => {
    await page.goto('/users');
    // bootstrap imports the app asynchronously after hostInit; wait until it rendered
    await expect(shell(page)).toBeVisible();
    const result = await page.evaluate(async () => {
      // Load our own exposed modules through the federation runtime, exactly as a host would.
      const federation = (window as unknown as { __FEDERATION__: { __INSTANCES__: Array<{ name: string; loadRemote: <T>(id: string) => Promise<T> }> } }).__FEDERATION__;
      const inst = federation.__INSTANCES__.find((i) => i.name === 'portal17')!;
      const entry = new URL('/remoteEntry.js', location.href).href;
      (inst as unknown as { registerRemotes: (r: unknown[]) => void }).registerRemotes([
        { name: 'portal17self', entry, type: 'module', entryGlobalName: 'portal17' },
      ]);
      type Mod = { mount: (el: HTMLElement, p: unknown) => { update(p: unknown): void; unmount(): void } };
      const users = await inst.loadRemote<Mod>('portal17self/UsersPage');
      const card = await inst.loadRemote<Mod>('portal17self/ProfileCard');
      const el = document.createElement('div');
      document.body.appendChild(el);
      const base = { navigate: () => {}, theme: 'dark', host: 'test' };
      const selected: string[] = [];
      const h = users.mount(el, { ...base, onSelectUser: (u: { id: string }) => selected.push(u.id) });
      const root = el.querySelector('[data-mfe="UsersPage"]') as HTMLElement;
      const out: Record<string, unknown> = {
        usersVersion: root.dataset.reactVersion,
        usersTheme: root.dataset.theme,
      };
      (el.querySelector('[data-user-id="u-2"]') as HTMLElement).click();
      out.selected = selected.slice();
      h.update({ ...base, onSelectUser: () => {}, selectedUserId: 'u-5' });
      out.highlighted = el.querySelector('[aria-selected="true"]')?.getAttribute('data-user-id');
      h.unmount();
      out.afterUnmount = el.innerHTML;

      const el2 = document.createElement('div');
      document.body.appendChild(el2);
      const h2 = card.mount(el2, { ...base, theme: 'light', user: { id: 'u-9', name: 'Zed Zero', email: 'z@x.test', role: 'admin' } });
      out.cardVersion = (el2.querySelector('[data-mfe="ProfileCard"]') as HTMLElement).dataset.reactVersion;
      out.cardName = el2.querySelector('[data-testid="profile-card-name"]')?.textContent;
      h2.unmount();
      out.cardAfterUnmount = el2.innerHTML;
      el.remove();
      el2.remove();
      return out;
    });
    expect(result).toEqual({
      usersVersion: '17.0.2',
      usersTheme: 'dark',
      selected: ['u-2'],
      highlighted: 'u-5',
      afterUnmount: '',
      cardVersion: '17.0.2',
      cardName: 'Zed Zero',
      cardAfterUnmount: '',
    });
  });
});
