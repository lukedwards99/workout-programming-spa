import { useState, useEffect } from 'react';
import type { ProgramTrainingSummary } from '../types/domain';
import { summaryApi } from '../api/summaryApi';
import SummaryStatGrid, { buildStatSections } from '../components/summary/SummaryStatGrid';
import SummaryBreakdownTables from '../components/summary/SummaryBreakdownTables';
import { useSummarySetTypeFilter } from '../components/summary/SummarySetTypeFilter';
import { formatCount } from '../components/summary/formatSummary';

export default function ProgramSummaryPage() {
  const [data, setData] = useState<ProgramTrainingSummary | null>(null);
  const { selectedSetTypes } = useSummarySetTypeFilter();

  useEffect(() => {
    const summary = summaryApi.getProgramSummary(selectedSetTypes);
    setData(summary);
  }, [selectedSetTypes]);

  if (!data) return <div className="empty-state"><p>Loading...</p></div>;

  return (
    <>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16, marginTop: -8 }}>
        Strength programmed statistics &mdash; cardio exercises are not included.
      </p>

      <SummaryStatGrid
        sections={buildStatSections(data.totals, [
          { label: 'Mesocycles', value: formatCount(data.mesocycles) },
        ])}
        caption="Program strength training summary"
      />

      <SummaryBreakdownTables
        byExerciseGroup={data.byExerciseGroup}
        byExercise={data.byExercise}
      />
    </>
  );
}
