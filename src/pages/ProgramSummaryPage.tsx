import { useState, useEffect } from 'react';
import type { ProgramTrainingSummary } from '../types/domain';
import { summaryApi } from '../api/summaryApi';
import SummaryStatGrid, { buildStatItems } from '../components/summary/SummaryStatGrid';
import SummaryBreakdownTables from '../components/summary/SummaryBreakdownTables';
import { formatCount } from '../components/summary/formatSummary';

export default function ProgramSummaryPage() {
  const [data, setData] = useState<ProgramTrainingSummary | null>(null);

  useEffect(() => {
    const summary = summaryApi.getProgramSummary();
    setData(summary);
  }, []);

  if (!data) return <div className="empty-state"><p>Loading...</p></div>;

  const hasData = data.totals.totalSets > 0;

  return (
    <>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16, marginTop: -8 }}>
        Programmed statistics &mdash; calculated from your training plan, not completed sessions.
      </p>

      <SummaryStatGrid
        stats={buildStatItems(data.totals, [
          { label: 'Mesocycles', value: formatCount(data.mesocycles) },
        ])}
        caption="Program training summary"
      />

      {!hasData && (
        <div className="empty-state">
          <p>No programmed training data yet. Add mesocycles, workouts, and sets to see statistics.</p>
        </div>
      )}

      {hasData && (
        <SummaryBreakdownTables
          byExerciseGroup={data.byExerciseGroup}
          byExercise={data.byExercise}
        />
      )}
    </>
  );
}
