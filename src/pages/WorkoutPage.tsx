import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { libraryApi, programsApi, trainingApi, type WorkoutSessionDetail } from '../api/cloudApi';
import FormModal from '../components/FormModal';
import { useSession } from '../contexts/SessionContext';
import type { Exercise, WorkoutDetail, WorkoutExerciseBlock } from '../types/cloud';

export default function WorkoutPage() {
  const { programId = '', workoutId = '' } = useParams();
  const { workspaceId, principal } = useSession();
  const membership = principal?.memberships.find((item) => item.workspaceId === workspaceId);
  const canPlan = membership?.role === 'owner' || membership?.role === 'coach';
  const canPerform = membership?.role === 'owner' || membership?.role === 'client';
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [session, setSession] = useState<WorkoutSessionDetail | null>(null);
  const [exerciseId, setExerciseId] = useState('');
  const [showExercise, setShowExercise] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const [detail, library, sessions] = await Promise.all([programsApi.workout(workspaceId, programId, workoutId), libraryApi.exercises(workspaceId), trainingApi.list(workspaceId, programId)]);
      const active = sessions.find((item) => item.workout_id === workoutId && item.status === 'in_progress');
      const activeDetail = active ? await trainingApi.get(workspaceId, programId, active.id) : null;
      setWorkout(detail); setExercises(library); setSession(activeDetail); setError(null);
    } catch (reason) { setError((reason as Error).message); }
  }, [workspaceId, programId, workoutId]);
  useEffect(() => { void load(); }, [load]);

  const addExercise = async (event: FormEvent) => {
    event.preventDefault(); if (!workspaceId || !exerciseId || !workout) return;
    try { await programsApi.addExercise(workspaceId, programId, workoutId, { exerciseId, exerciseOrder: workout.exercise_blocks.length }); setShowExercise(false); setExerciseId(''); await load(); }
    catch (reason) { setError((reason as Error).message); }
  };
  const addSet = async (block: WorkoutExerciseBlock) => {
    if (!workspaceId) return;
    const setNumber = block.sets.length + 1;
    try {
      if (block.exercise_type === 'strength') await programsApi.addStrengthSet(workspaceId, programId, block.id, { setNumber, setType: 'normal', plannedReps: 8 });
      else await programsApi.addCardioSet(workspaceId, programId, block.id, { setNumber, plannedDurationSeconds: 600 });
      await load();
    } catch (reason) { setError((reason as Error).message); }
  };
  const start = async () => { if (workspaceId) try { const created = await trainingApi.start(workspaceId, programId, workoutId); setSession({ ...created, strength_results: [], cardio_results: [] }); } catch (reason) { setError((reason as Error).message); } };
  const finish = async (status: 'completed' | 'skipped') => { if (workspaceId && session) try { await trainingApi.finish(workspaceId, programId, session, status); setSession(null); } catch (reason) { setError((reason as Error).message); } };

  if (!workout) return <div className="empty-state">{error ?? 'Loading workout…'}</div>;
  return <>
    <div className="breadcrumb"><Link to={`/programs/${programId}`}>Program</Link><span>/</span>{workout.name}</div>
    <div className="page-header"><div><h1>{workout.name}</h1><p className="page-subtitle">{canPlan ? 'Plan mode: edit targets and structure.' : 'Performance mode: record your own actual results.'}</p></div><div className="actions">{canPlan && <button className="btn btn-primary" onClick={() => setShowExercise(true)}>Add exercise</button>}{canPerform && !session && <button className="btn btn-success" onClick={() => void start()}>Start workout</button>}</div></div>
    {error && <div className="alert alert-danger">{error}</div>}
    {session && <div className="alert alert-success session-banner"><span>Workout in progress. Record actuals below.</span><div className="actions"><button className="btn btn-outline btn-sm" onClick={() => void finish('skipped')}>Skip</button><button className="btn btn-success btn-sm" onClick={() => void finish('completed')}>Complete</button></div></div>}
    {workout.exercise_blocks.length === 0 ? <div className="empty-state"><p>No exercises in this workout.</p></div> : workout.exercise_blocks.map((block) => <section className="card exercise-block" key={block.id}>
      <div className="section-header"><div><h2>{block.exercise_name}{block.variation_name ? ` — ${block.variation_name}` : ''}</h2><p className="muted">{block.group_name} · {block.exercise_type}</p></div>{canPlan && <div className="actions"><button className="btn btn-outline btn-sm" onClick={() => void addSet(block)}>Add set</button><button className="btn btn-danger btn-sm" onClick={async () => { if (workspaceId) { await programsApi.removeExercise(workspaceId, programId, block.id); await load(); } }}>Remove</button></div>}</div>
      {block.sets.length === 0 ? <p className="muted">No planned sets.</p> : <div className="table-wrap"><table><thead><tr><th>Set</th><th>Target</th>{session && <th>Actual</th>}</tr></thead><tbody>{block.sets.map((set) => <tr key={set.id}><td>{set.set_number}</td><td>{canPlan ? <PlanSetEditor set={set} workspaceId={workspaceId!} programId={programId} onError={setError} /> : ('planned_reps' in set ? `${set.planned_reps ?? '—'} reps @ ${set.planned_weight ?? '—'}` : `${set.planned_duration_seconds ?? '—'} sec / ${set.planned_distance ?? '—'} ${set.distance_unit ?? ''}`)}</td>{session && <td><ResultEditor block={block} set={set} session={session} workspaceId={workspaceId!} programId={programId} onError={setError} /></td>}</tr>)}</tbody></table></div>}
    </section>)}
    <FormModal show={showExercise} onHide={() => setShowExercise(false)} title="Add workspace exercise" onSubmit={addExercise} submitDisabled={!exerciseId}><div className="form-group"><label>Exercise</label><select value={exerciseId} onChange={(event) => setExerciseId(event.target.value)}><option value="">Choose…</option>{exercises.map((item) => <option value={item.id} key={item.id}>{item.name} ({item.exercise_type})</option>)}</select></div></FormModal>
  </>;
}

function PlanSetEditor({ set, workspaceId, programId, onError }: { set: WorkoutExerciseBlock['sets'][number]; workspaceId: string; programId: string; onError: (value: string) => void }) {
  const strength = 'planned_reps' in set;
  const [first, setFirst] = useState(String(strength ? set.planned_reps ?? '' : set.planned_duration_seconds ?? ''));
  const [second, setSecond] = useState(String(strength ? set.planned_weight ?? '' : set.planned_distance ?? ''));
  const [version, setVersion] = useState(set.version);
  const [saved, setSaved] = useState(false);
  const save = async () => {
    try {
      const updated = strength
        ? await programsApi.updateStrengthSet(workspaceId, programId, set.id, { setNumber: set.set_number, setType: set.set_type, plannedReps: first ? Number(first) : null, plannedWeight: second ? Number(second) : null, targetRir: set.target_rir, coachNotes: set.coach_notes ?? '', version })
        : await programsApi.updateCardioSet(workspaceId, programId, set.id, { setNumber: set.set_number, plannedDurationSeconds: first ? Number(first) : null, plannedDistance: second ? Number(second) : null, distanceUnit: set.distance_unit, targetRpe: set.target_rpe, coachNotes: set.coach_notes ?? '', version });
      setVersion(updated.version);
      setSaved(true);
    } catch (reason) { onError((reason as Error).message); }
  };
  return <div className="result-entry"><input aria-label={strength ? 'Planned reps' : 'Planned seconds'} type="number" min="0" placeholder={strength ? 'reps' : 'seconds'} value={first} onChange={(event) => { setFirst(event.target.value); setSaved(false); }} /><input aria-label={strength ? 'Planned weight' : 'Planned distance'} type="number" min="0" step="any" placeholder={strength ? 'weight' : 'distance'} value={second} onChange={(event) => { setSecond(event.target.value); setSaved(false); }} /><button className="btn btn-sm btn-outline" onClick={() => void save()}>{saved ? 'Saved' : 'Save'}</button></div>;
}

function ResultEditor({ block, set, session, workspaceId, programId, onError }: { block: WorkoutExerciseBlock; set: WorkoutExerciseBlock['sets'][number]; session: WorkoutSessionDetail; workspaceId: string; programId: string; onError: (value: string) => void }) {
  const existing = block.exercise_type === 'strength'
    ? session.strength_results.find((row) => row.strength_set_id === set.id)
    : session.cardio_results.find((row) => row.cardio_set_id === set.id);
  const initialFirst = existing && 'strength_set_id' in existing ? existing.actual_reps : existing?.actual_duration_seconds;
  const initialSecond = existing && 'strength_set_id' in existing ? existing.actual_weight : existing?.actual_distance;
  const [first, setFirst] = useState(String(initialFirst ?? ''));
  const [second, setSecond] = useState(String(initialSecond ?? ''));
  const [version, setVersion] = useState(existing?.version);
  const [saved, setSaved] = useState(Boolean(existing));
  const save = async () => {
    try {
      const updated = block.exercise_type === 'strength'
        ? await trainingApi.strengthResult(workspaceId, programId, session.id, { strengthSetId: set.id, actualReps: first ? Number(first) : null, actualWeight: second ? Number(second) : null, ...(version ? { version } : {}) })
        : await trainingApi.cardioResult(workspaceId, programId, session.id, { cardioSetId: set.id, actualDurationSeconds: first ? Number(first) : null, actualDistance: second ? Number(second) : null, ...(version ? { version } : {}) });
      setVersion(updated.version);
      setSaved(true);
    } catch (reason) { onError((reason as Error).message); }
  };
  return <div className="result-entry"><input aria-label={block.exercise_type === 'strength' ? 'Actual reps' : 'Actual seconds'} type="number" min="0" placeholder={block.exercise_type === 'strength' ? 'reps' : 'seconds'} value={first} onChange={(event) => { setFirst(event.target.value); setSaved(false); }} /><input aria-label={block.exercise_type === 'strength' ? 'Actual weight' : 'Actual distance'} type="number" min="0" step="any" placeholder={block.exercise_type === 'strength' ? 'weight' : 'distance'} value={second} onChange={(event) => { setSecond(event.target.value); setSaved(false); }} /><button className="btn btn-sm btn-outline" onClick={() => void save()}>{saved ? 'Saved' : 'Save'}</button></div>;
}
