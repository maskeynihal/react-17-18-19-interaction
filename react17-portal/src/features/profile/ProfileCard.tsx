import React from 'react';
import type { User } from '../../mfe/contract';
import '../../styles/widgets.css';
import './profile.css';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

/** Router-free React 17 user card. */
export function ProfileCard({ user }: { user: User }) {
  return (
    <div className="r17-profile-card" data-testid="profile-card" data-user-id={user.id}>
      <div className="r17-profile-card__avatar" aria-hidden="true">
        {initials(user.name)}
      </div>
      <div className="r17-profile-card__body">
        <div className="r17-profile-card__name" data-testid="profile-card-name">
          {user.name}
        </div>
        <div className="r17-profile-card__email">{user.email}</div>
        <span className={`r17-role r17-role--${user.role}`}>{user.role}</span>
      </div>
      <div className="r17-profile-card__footer">React {React.version} · Legacy Portal</div>
    </div>
  );
}
