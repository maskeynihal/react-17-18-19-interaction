import { useState } from 'react';
import type { User } from '../mfe/contract';
import { UsersPage } from '../features/users/UsersPage';
import { ProfileCard } from '../features/profile/ProfileCard';

/** Standalone /users route: wraps the same router-free UsersPage the adapter exposes. */
export function UsersRoute() {
  const [selected, setSelected] = useState<User | undefined>(undefined);
  return (
    <div className="r17-page r17-mfe-root">
      <h1 className="r17-page__title">Users</h1>
      <div className="r17-split">
        <div className="r17-split__main">
          <UsersPage onSelectUser={setSelected} selectedUserId={selected?.id} />
        </div>
        <aside className="r17-split__side">
          {selected ? (
            <>
              <p data-testid="selected-user">Selected: {selected.name}</p>
              <ProfileCard user={selected} />
            </>
          ) : (
            <p className="r17-muted">Select a user to see their card.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
