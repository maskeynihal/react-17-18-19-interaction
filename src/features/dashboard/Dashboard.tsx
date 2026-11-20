import type { ReactNode } from 'react';
import type { DashboardPageProps } from '../../mfe/contract';
import { PLANS, PLAN_LABELS, computeMrr, countByPlan, formatCurrency } from '../../domain';
import { StatsCard } from '../stats/StatsCard';
import '../../styles/r19.css';

export interface DashboardProps extends DashboardPageProps {
  /** Standalone-only slot (e.g. the portal17 ProfileCard). Never set when exposed. */
  aside?: ReactNode;
}

export function Dashboard({ customers, currentUser, navigate, aside }: DashboardProps) {
  const byPlan = countByPlan(customers);
  const max = Math.max(1, ...PLANS.map((p) => byPlan[p]));
  const recent = [...customers].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  return (
    <section className="r19-page" data-testid="dashboard">
      <div className="r19-page-head">
        <div>
          <h1 className="r19-page-title">Customer dashboard</h1>
          {currentUser && <p className="r19-page-sub">Welcome back, {currentUser.name}</p>}
        </div>
        <button type="button" className="r19-btn" data-testid="dashboard-new-customer" onClick={() => navigate('/customers/new')}>
          New customer
        </button>
      </div>

      <div className="r19-kpis">
        <StatsCard testId="kpi-total" label="Total customers" value={customers.length} />
        <StatsCard testId="kpi-mrr" label="MRR" value={formatCurrency(computeMrr(customers))} />
        {PLANS.map((p) => (
          <StatsCard key={p} testId={`kpi-plan-${p}`} label={PLAN_LABELS[p]} value={byPlan[p]} />
        ))}
      </div>

      <div className="r19-grid-2">
        <div className="r19-card">
          <h2 className="r19-card-title">Customers by plan</h2>
          <div className="r19-chart" data-testid="plan-chart" role="img" aria-label="Customers by plan">
            {PLANS.map((p) => (
              <div className="r19-bar-row" key={p}>
                <span>{PLAN_LABELS[p]}</span>
                <div className="r19-bar-track">
                  <div className="r19-bar-fill" data-plan={p} style={{ width: `${(byPlan[p] / max) * 100}%` }} />
                </div>
                <span className="r19-bar-count">{byPlan[p]}</span>
              </div>
            ))}
          </div>
        </div>
        {aside}
      </div>

      <div className="r19-card">
        <h2 className="r19-card-title">Recent customers</h2>
        <table className="r19-table" data-testid="recent-customers">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Plan</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((c) => (
              <tr key={c.id} data-testid="recent-customer-row">
                <td>{c.name}</td>
                <td>{c.email}</td>
                <td>
                  <span className="r19-badge" data-plan={c.plan}>
                    {PLAN_LABELS[c.plan]}
                  </span>
                </td>
                <td>{new Date(c.createdAt).toLocaleDateString('en-US')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
