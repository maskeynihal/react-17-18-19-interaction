import { useMemo } from 'react';
import type { DashboardPageProps } from '../mfe/contract';
import { RemoteMount } from '../host/RemoteMount';
import { useHostProps } from '../host/useHostProps';
import { useCustomerStore } from '../store/CustomerStore';
import { CURRENT_USER } from '../features/users/users';

export function DashboardRoute() {
  const { navigate, theme, host } = useHostProps();
  const { customers } = useCustomerStore();
  const props = useMemo<DashboardPageProps>(
    () => ({ navigate, theme, host, customers, currentUser: CURRENT_USER }),
    [navigate, theme, host, customers],
  );
  return (
    <div className="r17-page">
      <RemoteMount remote="app19/DashboardPage" props={props} />
    </div>
  );
}
