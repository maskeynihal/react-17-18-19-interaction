import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Dashboard } from '../features/dashboard/Dashboard';
import { RemoteMount } from '../mfe/RemoteMount';
import type { HostProps, ProfileCardProps } from '../mfe/contract';
import { CURRENT_USER, useCustomers } from '../store/customerStore';

export function DashboardRoute({ theme }: { theme: HostProps['theme'] }) {
  const customers = useCustomers();
  const navigate = useNavigate();
  const profileProps = useMemo<ProfileCardProps>(
    () => ({ user: CURRENT_USER, navigate: (p) => void navigate(p), theme, host: 'app19' }),
    [navigate, theme],
  );

  return (
    <Dashboard
      customers={customers}
      currentUser={CURRENT_USER}
      navigate={(p) => void navigate(p)}
      theme={theme}
      host="app19"
      aside={
        <div className="r19-card" data-testid="profile-slot">
          <h2 className="r19-card-title">Your profile · from the React 17 portal</h2>
          <RemoteMount<ProfileCardProps> remote="portal17/ProfileCard" props={profileProps} />
        </div>
      }
    />
  );
}
