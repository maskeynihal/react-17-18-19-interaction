import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { StatsWidgetProps } from '../mfe/contract';
import { RemoteMount } from '../host/RemoteMount';
import { useHostProps } from '../host/useHostProps';
import { useCustomerStore } from '../store/CustomerStore';

export function HomePage() {
  const { navigate, theme, host } = useHostProps();
  const { customers } = useCustomerStore();
  const [revenue, setRevenue] = useState(12500);
  const [trend, setTrend] = useState(4);
  const [wrapperClicks, setWrapperClicks] = useState(0);

  const customersWidget = useMemo<StatsWidgetProps>(
    () => ({ navigate, theme, host, label: 'Customers', value: customers.length, trend: 2 }),
    [navigate, theme, host, customers.length],
  );
  const revenueWidget = useMemo<StatsWidgetProps>(
    () => ({ navigate, theme, host, label: 'Revenue', value: revenue, trend }),
    [navigate, theme, host, revenue, trend],
  );

  return (
    <div className="r17-page">
      <h1 className="r17-page__title">Welcome to the Main Portal</h1>
      <p>
        This shell runs React {React.version}. The KPI cards below are React 19 widgets loaded at runtime from{' '}
        <code>app19</code>. Update your details on the <Link to="/profile">profile form</Link>.
      </p>

      <fieldset className="r17-panel">
        <legend>Key figures (embedded app19/StatsWidget)</legend>
        <div
          className="r17-widgets"
          data-testid="host-click-wrapper"
          onClick={() => setWrapperClicks((n) => n + 1)}
        >
          <div className="r17-widgets__cell" data-testid="widget-customers">
            <RemoteMount remote="app19/StatsWidget" props={customersWidget} />
          </div>
          <div className="r17-widgets__cell" data-testid="widget-revenue">
            <RemoteMount remote="app19/StatsWidget" props={revenueWidget} />
          </div>
        </div>
        <div className="r17-panel__actions">
          <button
            type="button"
            className="r17-btn"
            data-testid="bump"
            onClick={() => {
              setRevenue((r) => r + 1000);
              setTrend((t) => t + 1);
            }}
          >
            Bump revenue (+1000)
          </button>
          <span className="r17-muted">
            Host wrapper clicks: <span data-testid="host-clicks">{wrapperClicks}</span>
          </span>
        </div>
      </fieldset>
    </div>
  );
}
