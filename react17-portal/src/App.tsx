import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { on } from './mfe/contract';
import { Shell } from './host/Shell';
import { ThemeProvider } from './host/theme';
import { useStableNavigate } from './host/useHostProps';
import { CustomerStoreProvider, useCustomerStore } from './store/CustomerStore';
import { ToastProvider } from './store/Toast';
import { HomePage } from './pages/HomePage';
import { UsersRoute } from './pages/UsersRoute';
import { ProfileRoute } from './pages/ProfileRoute';
import { DashboardRoute } from './pages/DashboardRoute';
import { CustomerNewRoute } from './pages/CustomerNewRoute';
import { NotFound } from './pages/NotFound';

/** Window-level mfe:* listeners. Adds are deduped by id in the store. */
function MfeEventBridge() {
  const { addCustomer } = useCustomerStore();
  const navigate = useStableNavigate();
  useEffect(() => {
    const offCreated = on('mfe:customer-created', (customer) => addCustomer(customer));
    const offNavigate = on('mfe:navigate', ({ path }) => navigate(path));
    return () => {
      offCreated();
      offNavigate();
    };
  }, [addCustomer, navigate]);
  return null;
}

export function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <CustomerStoreProvider>
          <ToastProvider>
            <MfeEventBridge />
            <Routes>
              <Route element={<Shell />}>
                <Route index element={<HomePage />} />
                <Route path="users" element={<UsersRoute />} />
                <Route path="profile" element={<ProfileRoute />} />
                <Route path="dashboard" element={<DashboardRoute />} />
                <Route path="customers/new" element={<CustomerNewRoute />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </ToastProvider>
        </CustomerStoreProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
