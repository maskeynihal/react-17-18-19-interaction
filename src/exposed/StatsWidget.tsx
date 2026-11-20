import type { MountFn, StatsWidgetProps } from '../mfe/contract';
import { StatsCard } from '../features/stats/StatsCard';
import { createMount } from './createMount';

function StatsWidget({ label, value, trend }: StatsWidgetProps) {
  return (
    <div className="r19-stats-widget">
      <StatsCard testId="stats-widget" label={label} value={value} trend={trend} />
    </div>
  );
}

export const mount: MountFn<StatsWidgetProps> = createMount<StatsWidgetProps>('StatsWidget', StatsWidget);
export default mount;
