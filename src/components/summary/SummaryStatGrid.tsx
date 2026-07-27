import { formatCount, formatVolume, formatAverage } from './formatSummary';

export interface StatItem {
  value: string;
  label: string;
}

export interface StatSection {
  id: 'structure' | 'sets' | 'workload' | 'averages';
  title: string;
  stats: StatItem[];
}

interface SummaryStatGridProps {
  sections: StatSection[];
  caption?: string;
}

export default function SummaryStatGrid({ sections, caption }: SummaryStatGridProps) {
  return (
    <section className="summary-overview" aria-label={caption || 'Summary statistics'}>
      <h2 className="summary-overview-title">Overview</h2>
      <div className="stats-grid summary-stat-sections">
        {sections.map((section) => (
          <section className="summary-stat-section" aria-labelledby={`summary-section-${section.id}`} key={section.id}>
            <h3 id={`summary-section-${section.id}`}>{section.title}</h3>
            <dl className="summary-stat-list">
              {section.stats.map((stat) => (
                <div className="stat-card summary-stat-item" key={stat.label}>
                  <dt className="lbl">{stat.label}</dt>
                  <dd className="val">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </section>
  );
}

export function buildStatSections(
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
  structureStats: StatItem[] = [],
): StatSection[] {
  const structure = [...structureStats];
  if (data.workouts !== undefined) {
    structure.push({ value: formatCount(data.workouts), label: 'Programmed Workouts' });
  }
  structure.push(
    { value: formatCount(data.distinctExercises), label: 'Programmed Exercises' },
    { value: formatCount(data.distinctVariations), label: 'Programmed Variations' },
  );

  return [
    { id: 'structure', title: 'Program structure', stats: structure },
    {
      id: 'sets',
      title: 'Sets',
      stats: [
        { value: formatCount(data.totalSets), label: 'Programmed Sets' },
        { value: formatCount(data.workingSets), label: 'Programmed Working Sets' },
        { value: formatCount(data.warmupSets), label: 'Programmed Warm-up Sets' },
      ],
    },
    {
      id: 'workload',
      title: 'Workload',
      stats: [
        { value: formatCount(data.programmedReps), label: 'Programmed Reps' },
        { value: formatVolume(data.programmedVolume), label: 'Programmed Volume' },
      ],
    },
    {
      id: 'averages',
      title: 'Averages',
      stats: [
        { value: formatAverage(data.averageRepsPerWorkingSet), label: 'Avg Reps / Selected Set' },
        { value: formatAverage(data.averageRir), label: 'Avg RIR' },
      ],
    },
  ];
}
