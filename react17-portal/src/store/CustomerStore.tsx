import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Customer } from '../mfe/contract';

const SEED: Customer[] = [
  { id: 'c-1001', name: 'Acme Corp', email: 'ops@acme.test', plan: 'enterprise', createdAt: '2026-01-14T09:00:00.000Z' },
  { id: 'c-1002', name: 'Globex', email: 'it@globex.test', plan: 'pro', createdAt: '2026-03-02T10:30:00.000Z' },
  { id: 'c-1003', name: 'Initech', email: 'admin@initech.test', plan: 'free', createdAt: '2026-04-21T14:15:00.000Z' },
  { id: 'c-1004', name: 'Umbrella Ltd', email: 'contact@umbrella.test', plan: 'pro', createdAt: '2026-06-08T08:45:00.000Z' },
  { id: 'c-1005', name: 'Hooli', email: 'billing@hooli.test', plan: 'enterprise', createdAt: '2026-08-19T16:00:00.000Z' },
  { id: 'c-1006', name: 'Vandelay Industries', email: 'art@vandelay.test', plan: 'free', createdAt: '2026-10-30T11:20:00.000Z' },
];

interface CustomerStoreValue {
  customers: Customer[];
  /** Adds the customer unless one with the same id already exists. */
  addCustomer: (customer: Customer) => void;
}

const CustomerStoreContext = createContext<CustomerStoreValue | null>(null);

// Host-only state. Never passed across the MF boundary as context — only the
// `customers` array (plain data) is handed to remotes via props.
export function CustomerStoreProvider({ children }: { children: React.ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>(SEED);
  const addCustomer = useCallback((customer: Customer) => {
    // Dedupe inside the updater: onSubmit and `mfe:customer-created` arrive back to back.
    setCustomers((prev) => (prev.some((c) => c.id === customer.id) ? prev : [...prev, customer]));
  }, []);
  const value = useMemo(() => ({ customers, addCustomer }), [customers, addCustomer]);
  return <CustomerStoreContext.Provider value={value}>{children}</CustomerStoreContext.Provider>;
}

export function useCustomerStore(): CustomerStoreValue {
  const ctx = useContext(CustomerStoreContext);
  if (!ctx) throw new Error('useCustomerStore must be used inside CustomerStoreProvider');
  return ctx;
}
