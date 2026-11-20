import '../../styles/r19.css';

export interface StatsCardProps {
  label: string;
  value: number | string;
  trend?: number;
  testId?: string;
}

function trendDir(trend: number): 'up' | 'down' | 'flat' {
  if (trend > 0) return 'up';
  if (trend < 0) return 'down';
  return 'flat';
}

export function StatsCard({ label, value, trend, testId }: StatsCardProps) {
  const formatted = typeof value === 'number' ? value.toLocaleString('en-US') : value;
  return (
    <div className="r19-card r19-stats-card" data-testid={testId}>
      <div className="r19-kpi-label">{label}</div>
      <div className="r19-kpi-value" data-testid={testId ? `${testId}-value` : undefined}>
        {formatted}
      </div>
      {trend !== undefined && (
        <div className="r19-kpi-trend" data-dir={trendDir(trend)} data-testid={testId ? `${testId}-trend` : undefined}>
          {trend > 0 ? '▲' : trend < 0 ? '▼' : '•'} {Math.abs(trend).toFixed(1)}%
        </div>
      )}
    </div>
  );
}
