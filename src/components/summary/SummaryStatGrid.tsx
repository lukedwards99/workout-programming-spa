import { formatCount, formatVolume, formatAverage } from './formatSummary';

export interface StatItem {
  value: string;
  label: string;
}

interface SummaryStatGridProps {
  stats: StatItem[];
  caption?: string;
}

export default function SummaryStatGrid({ stats, caption }: SummaryStatGridProps) {
  return (
    <div role="region" aria-label={caption || 'Summary statistics'}>
      <div className="stats-grid">
        {stats.map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="val">{s.value}</div>
            <div className="lbl">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function buildStatItems(
  data: {
    workouts?: number;
    distinctExercises: number;
    distinctVariations: number;
    totalSets: number;
    workingSets: number;
    warmupSets: number;
    programmedReps: number;
    programmedVolume: number;
    averageRepsPerWorkingSet: number | null;
    averageRir: number | null;
  },
  extra?: { label: string; value: string }[],
): StatItem[] {
  const items: StatItem[] = [];

  if (data.workouts !== undefined) {
    items.push({ value: formatCount(data.workouts), label: 'Programmed Workouts' });
  }

  items.push(
    { value: formatCount(data.distinctExercises), label: 'Programmed Exercises' },
    { value: formatCount(data.distinctVariations), label: 'Programmed Variations' },
    { value: formatCount(data.totalSets), label: 'Programmed Sets' },
    { value: formatCount(data.workingSets), label: 'Programmed Working Sets' },
    { value: formatCount(data.warmupSets), label: 'Programmed Warm-up Sets' },
    { value: formatCount(data.programmedReps), label: 'Programmed Reps' },
    { value: formatVolume(data.programmedVolume), label: 'Programmed Volume' },
    { value: formatAverage(data.averageRepsPerWorkingSet), label: 'Avg Reps / Working Set' },
    { value: formatAverage(data.averageRir), label: 'Avg RIR' },
  );

  if (extra) items.push(...extra);

  return items;
}
