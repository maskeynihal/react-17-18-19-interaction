import { Link, useNavigate } from 'react-router';
import { CustomerForm } from '../features/customers/CustomerForm';
import type { HostProps } from '../mfe/contract';
import { customerStore } from '../store/customerStore';

export function CustomerFormRoute({ theme }: { theme: HostProps['theme'] }) {
  const navigate = useNavigate();
  return (
    <>
      <CustomerForm
        theme={theme}
        host="app19"
        navigate={(p) => void navigate(p)}
        onSubmit={(customer) => customerStore.add(customer)}
        onCancel={() => void navigate('/')}
      />
      <p>
        <Link to="/" data-testid="back-to-dashboard">← Back to dashboard</Link>
      </p>
    </>
  );
}
