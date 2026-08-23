import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { programsApi } from '../api/cloudApi';
import FormModal from '../components/FormModal';
import ConfirmModal from '../components/ConfirmModal';
import { useSession } from '../contexts/SessionContext';
import type { Mesocycle, Program, Workout } from '../types/cloud';

interface MesocycleWithWorkouts extends Mesocycle { workouts: Workout[]; }

export default function ProgramPage() {
  const { programId = '' } = useParams();
  const { workspaceId, principal } = useSession();
  const membership = principal?.memberships.find((item) => item.workspaceId === workspaceId);
  const canPlan = membership?.role === 'owner' || membership?.role === 'coach';
  const navigate = useNavigate();
  const [row, setRow] = useState<Program | null>(null);
  const [cycles, setCycles] = useState<MesocycleWithWorkouts[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [cycleModal, setCycleModal] = useState(false);
  const [workoutCycle, setWorkoutCycle] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [dayOffset, setDayOffset] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const [program, mesocycles, totals] = await Promise.all([
        programsApi.get(workspaceId, programId), programsApi.mesocycles(workspaceId, programId), programsApi.summary(workspaceId, programId),
      ]);
      const expanded = await Promise.all(mesocycles.map(async (cycle) => ({ ...cycle, workouts: await programsApi.workouts(workspaceId, programId, cycle.id) })));
      setRow(program); setCycles(expanded); setSummary(totals); setError(null);
    } catch (reason) { setError((reason as Error).message); }
  }, [workspaceId, programId]);
  useEffect(() => { void load(); }, [load]);

  const saveProgram = async (status: Program['status']) => {
    if (!workspaceId || !row) return;
    try { setRow(await programsApi.update(workspaceId, row, { name: row.name, notes: row.notes ?? undefined, status })); }
    catch (reason) { setError((reason as Error).message); }
  };
  const createCycle = async (event: FormEvent) => {
    event.preventDefault(); if (!workspaceId) return;
    try { await programsApi.createMesocycle(workspaceId, programId, { name, mesocycleLength: 7, startDate }); setName(''); setCycleModal(false); await load(); }
    catch (reason) { setError((reason as Error).message); }
  };
  const createWorkout = async (event: FormEvent) => {
    event.preventDefault(); if (!workspaceId || !workoutCycle) return;
    try { await programsApi.createWorkout(workspaceId, programId, workoutCycle, { name, dayOffset }); setName(''); setWorkoutCycle(null); await load(); }
    catch (reason) { setError((reason as Error).message); }
  };

  if (error && !row) return <div className="alert alert-danger">{error} <button className="inline-link" onClick={() => void load()}>Retry</button></div>;
  if (!row) return <div className="empty-state">Loading program…</div>;
  return <>
    <div className="breadcrumb"><Link to="/">Programs</Link><span>/</span>{row.name}</div>
    <div className="page-header"><div><h1>{row.name}</h1><div className="badge-row"><span className="badge">{row.kind}</span><span className={`status status-${row.status}`}>{row.status}</span>{row.client_name && <span className="badge">Client: {row.client_name}</span>}</div></div>
      {canPlan && <div className="actions"><select value={row.status} onChange={(event) => void saveProgram(event.target.value as Program['status'])}><option value="draft">Draft</option><option value="active">Active</option><option value="completed">Completed</option></select><button className="btn btn-outline btn-sm" onClick={async () => { const copyName = window.prompt('Name for the independent program copy', `${row.name} copy`); if (copyName && workspaceId) { const copy = await programsApi.copy(workspaceId, row.id, { name: copyName, kind: row.kind === 'template' ? 'template' : 'personal' }); navigate(`/programs/${copy.id}`); } }}>Copy</button><button className="btn btn-danger btn-sm" onClick={() => setDeleteOpen(true)}>Delete</button></div>}
    </div>
    {error && <div className="alert alert-danger">{error}</div>}
    <div className="stats-row">{Object.entries(summary).map(([label, value]) => <div className="stat" key={label}><strong>{value}</strong><span>{label.replace('_', ' ')}</span></div>)}</div>
    <div className="section-header"><h2>Plan</h2>{canPlan && <button className="btn btn-primary btn-sm" onClick={() => setCycleModal(true)}>Add mesocycle</button>}</div>
    {cycles.length === 0 ? <div className="empty-state"><p>This plan has no mesocycles yet.</p></div> : cycles.map((cycle) => <section className="card cycle-card" key={cycle.id}>
      <div className="section-header"><div><h3>{cycle.name}</h3><p className="muted">Starts {cycle.start_date} · {cycle.mesocycle_length} days</p></div>{canPlan && <div className="actions"><button className="btn btn-outline btn-sm" onClick={async () => { if (workspaceId) { await programsApi.generateWorkouts(workspaceId, row.id, cycle.id, [{ name: 'Day 1', dayOffset: 0 }, { name: 'Day 2', dayOffset: 2 }, { name: 'Day 3', dayOffset: 4 }]); await load(); } }}>Generate 3-day week</button><button className="btn btn-outline btn-sm" onClick={() => { setName(''); setWorkoutCycle(cycle.id); }}>Add workout</button></div>}</div>
      {cycle.workouts.length === 0 ? <p className="muted">No workouts</p> : <div className="workout-list">{cycle.workouts.map((workout) => <Link className="workout-row" key={workout.id} to={`/programs/${programId}/workouts/${workout.id}`}><span>{workout.name}</span><span className="muted">Day +{workout.day_offset}</span></Link>)}</div>}
    </section>)}
    <FormModal show={cycleModal} onHide={() => setCycleModal(false)} title="Add mesocycle" onSubmit={createCycle} submitDisabled={!name.trim()}><div className="form-group"><label>Name</label><input value={name} onChange={(event) => setName(event.target.value)} /></div><div className="form-group"><label>Start date</label><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div></FormModal>
    <FormModal show={Boolean(workoutCycle)} onHide={() => setWorkoutCycle(null)} title="Add workout" onSubmit={createWorkout} submitDisabled={!name.trim()}><div className="form-group"><label>Name</label><input value={name} onChange={(event) => setName(event.target.value)} /></div><div className="form-group"><label>Day offset</label><input type="number" min="0" value={dayOffset} onChange={(event) => setDayOffset(Number(event.target.value))} /></div></FormModal>
    <ConfirmModal show={deleteOpen} onHide={() => setDeleteOpen(false)} title="Delete program" message="Delete this program and all of its current plan and result data? Complete old rows will be retained in history." onConfirm={async () => { if (workspaceId) { await programsApi.remove(workspaceId, row.id); navigate('/'); } }} />
  </>;
}
