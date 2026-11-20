// ---- mount adapter ----
export interface MountHandle<P> {
  update(props: P): void;
  unmount(): void;
}
export type MountFn<P> = (el: HTMLElement, props: P) => MountHandle<P>;
export interface RemoteModule<P> {
  mount: MountFn<P>;
  default?: MountFn<P>;
}

// ---- shared domain (plain data only) ----
export type Plan = 'free' | 'pro' | 'enterprise';
export interface Customer {
  id: string;
  name: string;
  email: string;
  plan: Plan;
  createdAt: string; // ISO
}
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
}

// ---- props every remote receives ----
export interface HostProps {
  /** host owns routing; remote never uses its own router when embedded */
  navigate: (path: string) => void;
  /** host-provided theme token, remote applies it via data attribute */
  theme: 'light' | 'dark';
  /** identifies host for telemetry/testing, e.g. 'portal17' | 'app19' */
  host: string;
}

// react19-app exposes
export interface DashboardPageProps extends HostProps {
  customers: Customer[]; // host-owned data source
  currentUser?: User;
}
export interface CustomerFormPageProps extends HostProps {
  onSubmit: (customer: Customer) => void | Promise<void>;
  onCancel?: () => void;
}
export interface StatsWidgetProps extends HostProps {
  label: string;
  value: number;
  trend?: number; // percent
}

// react17-portal exposes
export interface UsersPageProps extends HostProps {
  onSelectUser: (user: User) => void;
  selectedUserId?: string;
}
export interface ProfileCardProps extends HostProps {
  user: User;
}

// ---- cross-app events (window CustomEvent) ----
export interface MfeEvents {
  'mfe:customer-created': Customer;
  'mfe:user-selected': User;
  'mfe:navigate': { path: string };
}
export type MfeEventName = keyof MfeEvents;
export function emit<K extends MfeEventName>(name: K, detail: MfeEvents[K]): void {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}
export function on<K extends MfeEventName>(
  name: K,
  handler: (detail: MfeEvents[K]) => void,
): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<MfeEvents[K]>).detail);
  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
}
