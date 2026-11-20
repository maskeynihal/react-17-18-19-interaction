import { useState } from 'react';
import type { User } from '../mfe/contract';
import { ProfileForm } from '../features/profile/ProfileForm';
import { ProfileCard } from '../features/profile/ProfileCard';
import { CURRENT_USER } from '../features/users/users';

export function ProfileRoute() {
  const [user, setUser] = useState<User>(CURRENT_USER);
  return (
    <div className="r17-page r17-mfe-root">
      <h1 className="r17-page__title">My Profile</h1>
      <div className="r17-split">
        <div className="r17-split__main">
          <ProfileForm initial={user} onSave={setUser} />
        </div>
        <aside className="r17-split__side">
          <ProfileCard user={user} />
        </aside>
      </div>
    </div>
  );
}
