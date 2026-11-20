import { version } from 'react';
import { NavLink, Outlet } from 'react-router';
import { useCustomers } from '../store/customerStore';
import type { HostProps } from '../mfe/contract';

export interface ShellProps {
  theme: HostProps['theme'];
  onToggleTheme: () => void;
}

export function Shell({ theme, onToggleTheme }: ShellProps) {
  const customers = useCustomers();
  return (
    <div className="r19-root r19-shell" data-app-shell="" data-react-version={version} data-theme={theme}>
      <header className="r19-header">
        <div className="r19-brand" data-testid="shell-title">
          <span className="r19-brand-dot" aria-hidden="true" />
          New App · React {version}
        </div>
        <nav className="r19-nav" aria-label="Main">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/customers/new">New customer</NavLink>
          <NavLink to="/legacy/users">Legacy users</NavLink>
        </nav>
        <span className="r19-badge" data-testid="shell-customer-count">{customers.length} customers</span>
        <button type="button" className="r19-btn r19-btn-ghost" onClick={onToggleTheme} data-testid="theme-toggle">
          {theme === 'dark' ? 'Light' : 'Dark'} mode
        </button>
      </header>
      <main className="r19-main">
        <Outlet />
      </main>
    </div>
  );
}
