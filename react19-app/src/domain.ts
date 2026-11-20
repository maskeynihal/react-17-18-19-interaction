import type { Customer, Plan } from './mfe/contract';

/** Monthly price per plan in USD — used for MRR. */
export const PLAN_PRICES: Record<Plan, number> = { free: 0, pro: 49, enterprise: 499 };
export const PLANS: Plan[] = ['free', 'pro', 'enterprise'];
export const PLAN_LABELS: Record<Plan, string> = { free: 'Free', pro: 'Pro', enterprise: 'Enterprise' };

export function computeMrr(customers: Customer[]): number {
  return customers.reduce((sum, c) => sum + PLAN_PRICES[c.plan], 0);
}

export function countByPlan(customers: Customer[]): Record<Plan, number> {
  const out: Record<Plan, number> = { free: 0, pro: 0, enterprise: 0 };
  for (const c of customers) out[c.plan] += 1;
  return out;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
