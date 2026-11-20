import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { Shell } from './shell/Shell';
import { DashboardRoute } from './pages/DashboardRoute';
import { CustomerFormRoute } from './pages/CustomerFormRoute';
import { LegacyUsersRoute } from './pages/LegacyUsersRoute';
import { on, type HostProps } from './mfe/contract';
import { customerStore } from './store/customerStore';

export function App() {
  const [theme, setTheme] = useState<HostProps['theme']>('light');

  // Any app (this one or an embedded remote) announcing a customer updates the store (idempotent by id).
  useEffect(() => on('mfe:customer-created', (c) => customerStore.add(c)), []);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell theme={theme} onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} />}>
          <Route index element={<DashboardRoute theme={theme} />} />
          <Route path="customers/new" element={<CustomerFormRoute theme={theme} />} />
          <Route path="legacy/users" element={<LegacyUsersRoute theme={theme} />} />
          <Route path="*" element={<p data-testid="not-found">Page not found.</p>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
