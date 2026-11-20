import { useSyncExternalStore } from 'react';
import type { Customer, User } from '../mfe/contract';

/** In-memory mock data store for the standalone app (no backend, per brief). */
const SEED: Customer[] = [
  { id: 'c-1', name: 'Acme Corp', email: 'ops@acme.test', plan: 'enterprise', createdAt: '2026-10-02T09:00:00.000Z' },
  { id: 'c-2', name: 'Globex', email: 'it@globex.test', plan: 'pro', createdAt: '2026-10-11T12:30:00.000Z' },
  { id: 'c-3', name: 'Initech', email: 'admin@initech.test', plan: 'free', createdAt: '2026-10-19T15:10:00.000Z' },
  { id: 'c-4', name: 'Umbrella Labs', email: 'hello@umbrella.test', plan: 'pro', createdAt: '2026-10-28T08:45:00.000Z' },
  { id: 'c-5', name: 'Stark Industries', email: 'tony@stark.test', plan: 'enterprise', createdAt: '2026-11-06T17:20:00.000Z' },
  { id: 'c-6', name: 'Wayne Enterprises', email: 'bruce@wayne.test', plan: 'free', createdAt: '2026-11-14T11:05:00.000Z' },
];

export const CURRENT_USER: User = {
  id: 'u-1',
  name: 'Ada Lovelace',
  email: 'ada@example.test',
  role: 'admin',
};

let customers: Customer[] = [...SEED];
const listeners = new Set<() => void>();

export const customerStore = {
  getSnapshot: (): Customer[] => customers,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Idempotent by id: the form route adds directly and the shell also listens to `mfe:customer-created`. */
  add(customer: Customer): void {
    if (customers.some((c) => c.id === customer.id)) return;
    customers = [...customers, customer];
    listeners.forEach((l) => l());
  },
};

export function useCustomers(): Customer[] {
  return useSyncExternalStore(customerStore.subscribe, customerStore.getSnapshot);
}
