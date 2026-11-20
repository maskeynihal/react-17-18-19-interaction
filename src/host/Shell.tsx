import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useCustomerStore } from '../store/CustomerStore';
import { useTheme } from './theme';
import { CURRENT_USER } from '../features/users/users';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/users', label: 'Users' },
  { to: '/profile', label: 'My Profile' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/customers/new', label: 'New Customer' },
];

export function Shell() {
  const { customers } = useCustomerStore();
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="r17-shell" data-app-shell="" data-react-version={React.version} data-theme={theme}>
      <header className="r17-shell__header">
        <div className="r17-shell__brand" data-testid="shell-title">
          Main Portal · React {React.version}
        </div>
        <div className="r17-shell__meta">
          <span className="r17-shell__badge" title="Customers in portal store">
            Customers <span data-testid="customer-count">{customers.length}</span>
          </span>
          <span className="r17-shell__user">Signed in as {CURRENT_USER.name}</span>
          <button type="button" className="r17-btn r17-btn--small" data-testid="theme-toggle" onClick={toggleTheme}>
            Theme: {theme}
          </button>
        </div>
      </header>
      <nav className="r17-shell__nav" aria-label="Main">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => (isActive ? 'r17-shell__link r17-shell__link--active' : 'r17-shell__link')}
          >
            {n.label}
          </NavLink>
        ))}
      </nav>
      <main className="r17-shell__main">
        <Outlet />
      </main>
      <footer className="r17-shell__footer">© 2026 Main Portal — legacy React {React.version} shell</footer>
    </div>
  );
}
