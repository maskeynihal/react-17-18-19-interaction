import { useMemo, useState } from 'react';
import { emit, type UsersPageProps } from '../../mfe/contract';
import { USERS } from './users';
import '../../styles/widgets.css';
import './users.css';

export type UsersPageViewProps = Pick<UsersPageProps, 'onSelectUser' | 'selectedUserId'>;

/**
 * Router-free React 17 users table (contract rule 2).
 * Used by the portal's /users route and by the ./UsersPage mount adapter.
 */
export function UsersPage({ onSelectUser, selectedUserId }: UsersPageViewProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return USERS;
    return USERS.filter((u) => [u.name, u.email, u.role].some((v) => v.toLowerCase().includes(q)));
  }, [query]);

  const select = (user: (typeof USERS)[number]) => {
    onSelectUser(user); // host-specific behaviour
    emit('mfe:user-selected', user); // anyone listening (rule 4)
  };

  return (
    <section className="r17-users">
      <div className="r17-users__toolbar">
        <h2 className="r17-users__title">User Directory</h2>
        <input
          type="search"
          className="r17-input"
          placeholder="Search name, email or role…"
          aria-label="Search users"
          data-testid="users-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <table className="r17-table" data-testid="users-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((u) => {
            const selected = u.id === selectedUserId;
            return (
              <tr
                key={u.id}
                data-testid="user-row"
                data-user-id={u.id}
                aria-selected={selected}
                className={selected ? 'r17-table__row r17-table__row--selected' : 'r17-table__row'}
                tabIndex={0}
                onClick={() => select(u)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    select(u);
                  }
                }}
              >
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <span className={`r17-role r17-role--${u.role}`}>{u.role}</span>
                </td>
              </tr>
            );
          })}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={3} className="r17-table__empty" data-testid="users-empty">
                No users match “{query}”.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="r17-users__count" data-testid="users-count">
        Showing {filtered.length} of {USERS.length} users
      </p>
    </section>
  );
}
