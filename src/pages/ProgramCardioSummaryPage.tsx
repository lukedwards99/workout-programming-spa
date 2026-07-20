import { useEffect, useState } from 'react';
import type { CardioTrainingSummary } from '../types/domain';
import { summaryApi } from '../api/summaryApi';
import CardioSummary from '../components/summary/CardioSummary';

export default function ProgramCardioSummaryPage() {
  const [data, setData] = useState<CardioTrainingSummary | null>(null);
  useEffect(() => setData(summaryApi.getProgramCardioSummary()), []);
  if (!data) return <div className="empty-state"><p>Loading...</p></div>;
  return <><p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16, marginTop: -8 }}>Planned and completed cardio across this program.</p><CardioSummary data={data} showMesocycle /></>;
}
