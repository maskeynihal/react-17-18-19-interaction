import { useMemo } from 'react';
import type { Customer, CustomerFormPageProps } from '../mfe/contract';
import { RemoteMount } from '../host/RemoteMount';
import { useHostProps } from '../host/useHostProps';
import { useCustomerStore } from '../store/CustomerStore';
import { useToast } from '../store/Toast';

export function CustomerNewRoute() {
  const { navigate, theme, host } = useHostProps();
  const { addCustomer } = useCustomerStore();
  const { showToast } = useToast();

  const props = useMemo<CustomerFormPageProps>(
    () => ({
      navigate,
      theme,
      host,
      onSubmit: (customer: Customer) => {
        addCustomer(customer); // deduped by id; mfe:customer-created may also arrive
        showToast(`Customer "${customer.name}" created`);
        navigate('/dashboard');
      },
      onCancel: () => navigate('/dashboard'),
    }),
    [navigate, theme, host, addCustomer, showToast],
  );

  // Rule 5: the remote's <form> is not nested inside any host <form>.
  return (
    <div className="r17-page">
      <RemoteMount remote="app19/CustomerFormPage" props={props} />
    </div>
  );
}
