import type { DashboardPageProps, MountFn } from '../mfe/contract';
import { Dashboard } from '../features/dashboard/Dashboard';
import { createMount } from './createMount';

export const mount: MountFn<DashboardPageProps> = createMount<DashboardPageProps>('DashboardPage', Dashboard);
export default mount;
