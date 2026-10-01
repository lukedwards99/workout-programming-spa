import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { libraryApi, programsApi } from '../api/cloudApi';
import FormModal from '../components/FormModal';
import ConfirmModal from '../components/ConfirmModal';
import Icon from '../components/Icon';
import { useSession } from '../contexts/SessionContext';
import type { CardioSet, Exercise, ExerciseVariation, Mesocycle, Program, StrengthSet, WorkoutDetail, WorkoutExerciseBlock } from '../types/cloud';

export default function WorkoutPage() {
  const { programId = '', workoutId = '' } = useParams(), navigate = useNavigate();
  const { workspaceId, principal } = useSession();
  const access = principal?.availableWorkspaces.find((item) => item.workspaceId === workspaceId);
  const canPlan = access?.role !== 'client';
  const [programRow, setProgramRow] = useState<Program | null>(null), [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]), [programs, setPrograms] = useState<Program[]>([]), [cycles, setCycles] = useState<Mesocycle[]>([]), [variations, setVariations] = useState<ExerciseVariation[]>([]);
  const [exerciseId, setExerciseId] = useState(''), [variationId, setVariationId] = useState('');
  const [showExercise, setShowExercise] = useState(false), [showCopy, setShowCopy] = useState(false), [removing, setRemoving] = useState<WorkoutExerciseBlock | null>(null);
  const [targetProgram, setTargetProgram] = useState(''), [targetCycle, setTargetCycle] = useState(''), [copyName, setCopyName] = useState(''), [includeExecuted, setIncludeExecuted] = useState(false), [error, setError] = useState(''), [adding, setAdding] = useState<string | null>(null);
  const canExecute = access?.role === 'admin' || access?.role === 'owner' || (access?.role === 'client' && programRow?.owner_user_id === principal?.userId);
  const load = useCallback(async () => {
    if (!workspaceId) return;
    const [detail, library, p, allPrograms] = await Promise.all([programsApi.workout(workspaceId, programId, workoutId), libraryApi.exercises(workspaceId), programsApi.get(workspaceId, programId), programsApi.list(workspaceId)]);
    setWorkout(detail); setExercises(library); setProgramRow(p); setPrograms(allPrograms); setTargetProgram((current) => current || programId); setCopyName(`${detail.name} copy`); setError('');
  }, [workspaceId, programId, workoutId]);
  useEffect(() => { void load().catch((e: Error) => setError(e.message)); }, [load]);
  useEffect(() => {
    if (!workspaceId || !targetProgram) return;
    let active = true;
    programsApi.mesocycles(workspaceId, targetProgram).then((rows) => { if (active) { setCycles(rows); setTargetCycle(rows[0]?.id ?? ''); } }).catch((e: Error) => setError(e.message));
    return () => { active = false; };
  }, [workspaceId, targetProgram]);
  useEffect(() => {
    setVariationId(''); setVariations([]);
    if (!workspaceId || !exerciseId) return;
    let active = true;
    libraryApi.variations(workspaceId, exerciseId).then((rows) => { if (active) { setVariations(rows); setVariationId(rows.find((r) => r.is_primary)?.id ?? ''); } }).catch((e: Error) => setError(e.message));
    return () => { active = false; };
  }, [workspaceId, exerciseId]);
  async function addExercise(e: FormEvent) {
    e.preventDefault(); if (!workspaceId || !exerciseId || !workout) return;
    await programsApi.addExercise(workspaceId, programId, workoutId, { exerciseId, exerciseVariationId: variationId || null, exerciseOrder: workout.exercise_blocks.length });
    setShowExercise(false); setExerciseId(''); await load();
  }
  async function addSet(block: WorkoutExerciseBlock) {
    if (!workspaceId) return; setAdding(block.id);
    try {
      const setNumber = Math.max(0, ...block.sets.map((s) => s.set_number)) + 1;
      if (block.exercise_type === 'strength') await programsApi.addStrengthSet(workspaceId, programId, block.id, { setNumber, setType: 'normal', plannedReps: 8 });
      else await programsApi.addCardioSet(workspaceId, programId, block.id, { setNumber, plannedDurationSeconds: 600 });
      await load();
    } catch (e) { setError((e as Error).message); } finally { setAdding(null); }
  }
  if (!workout) return <div className="empty-state"><p role={error ? 'alert' : 'status'}>{error || 'Loading workout…'}</p>{error && <button className="btn btn-outline" onClick={() => void load().catch((e: Error) => setError(e.message))}>Retry</button>}</div>;
  const totalSets = workout.exercise_blocks.reduce((n, b) => n + b.sets.length, 0);
  const recorded = workout.exercise_blocks.reduce((n, b) => n + b.sets.filter((s) => b.exercise_type === 'strength' ? (s as StrengthSet).actual_reps !== null : (s as CardioSet).actual_duration_seconds !== null).length, 0);
  return <>
    <div className="breadcrumb"><Link to="/">Programs</Link><Icon name="chevron" /><Link to={`/programs/${programId}`}>{programRow?.name ?? 'Program'}</Link><Icon name="chevron" /><span>{workout.name}</span></div>
    <div className="page-header"><div><h1>{workout.name}</h1><p className="page-subtitle">{workout.exercise_blocks.length} {workout.exercise_blocks.length === 1 ? 'exercise' : 'exercises'} · {totalSets} {totalSets === 1 ? 'set' : 'sets'} · {recorded} recorded</p></div>{canPlan && <div className="actions"><button className="btn btn-outline" onClick={() => { setIncludeExecuted(false); setShowCopy(true); }}><Icon name="copy" />Copy workout</button><button className="btn btn-primary" onClick={() => setShowExercise(true)}><Icon name="plus" />Add exercise</button></div>}</div>
    <p className="training-note"><Icon name="info" />{canPlan && canExecute ? 'Plan your sets, then record what you actually did. Save each section when you’re ready.' : canPlan ? 'Set the plan for each exercise. Your athlete records the results.' : 'Your plan is on the left. Record your results, then save each set.'}</p>
    {error && <div className="alert alert-danger" role="alert">{error}</div>}
    {!workout.exercise_blocks.length ? <div className="empty-state"><Icon name="barbell" /><h2>A session waiting to happen</h2><p>{canPlan ? 'Add an exercise from your library, then build its sets.' : 'Your coach has not added exercises yet.'}</p></div> : workout.exercise_blocks.map((block, index) => <section className="card exercise-block" key={block.id} aria-label={block.exercise_name}>
      <div className="section-header"><div><h2><span className="exercise-index">{String(index + 1).padStart(2, '0')}</span>{block.exercise_name}</h2><p className="muted">{block.group_name} · {block.variation_name ?? block.exercise_type}</p></div>{canPlan && <div className="actions"><button className="btn btn-outline btn-sm" disabled={adding === block.id} onClick={() => void addSet(block)}>{adding === block.id ? 'Adding…' : 'Add set'}</button><button className="quiet-button" onClick={() => setRemoving(block)}>Remove</button></div>}</div>
      {!block.sets.length ? <div className="empty-state">No sets yet. Add your first set to this exercise.</div> : <><div className="set-sheet-head"><span>Set</span><span>Planned</span><span>Executed</span></div>{block.sets.map((set) => <SetRow key={set.id} set={set} type={block.exercise_type} workspaceId={workspaceId!} programId={programId} canPlan={canPlan} canExecute={Boolean(canExecute)} onSaved={load} />)}</>}
    </section>)}
    <FormModal show={showExercise} onHide={() => setShowExercise(false)} title="Add workspace exercise" onSubmit={addExercise} submitDisabled={!exerciseId}><div className="form-group"><label>Exercise</label><select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}><option value="">Choose an exercise</option>{exercises.map((item) => <option value={item.id} key={item.id}>{item.name} ({item.exercise_type})</option>)}</select></div>{variations.length > 0 && <div className="form-group"><label>Variation</label><select value={variationId} onChange={(e) => setVariationId(e.target.value)}><option value="">No variation</option>{variations.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>}{!exercises.length && <p>Add exercises in the <Link to="/library">Exercise Library</Link> first.</p>}</FormModal>
    <FormModal show={showCopy} onHide={() => setShowCopy(false)} title="Copy workout" onSubmit={async (e) => { e.preventDefault(); if (!workspaceId || !targetCycle) return; const copy = await programsApi.copyWorkout(workspaceId, programId, workoutId, { targetProgramId: targetProgram, targetMesocycleId: targetCycle, name: copyName, includeExecutedValues: includeExecuted }); setShowCopy(false); navigate(`/programs/${targetProgram}/workouts/${copy.id}`); }} submitDisabled={!targetProgram || !targetCycle || !copyName.trim()}><div className="form-group"><label>Name</label><input maxLength={160} value={copyName} onChange={(e) => setCopyName(e.target.value)} /></div><div className="form-group"><label>Destination program</label><select value={targetProgram} onChange={(e) => setTargetProgram(e.target.value)}>{programs.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.owner_name}</option>)}</select></div><div className="form-group"><label>Destination mesocycle</label><select value={targetCycle} onChange={(e) => setTargetCycle(e.target.value)}><option value="">Choose a mesocycle</option>{cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}</select></div><label className="form-check"><input type="checkbox" checked={includeExecuted} onChange={(e) => setIncludeExecuted(e.target.checked)} /> Include executed values and athlete notes</label></FormModal>
    <ConfirmModal show={Boolean(removing)} onHide={() => setRemoving(null)} title="Remove exercise" message={`Remove ${removing?.exercise_name ?? 'this exercise'} and all of its planned and recorded sets from this workout?`} confirmLabel="Remove" onConfirm={async () => { if (!workspaceId || !removing) return; await programsApi.removeExercise(workspaceId, programId, removing.id); await load(); }} />
  </>;
}

function number(value: string) { return value === '' ? null : Number(value); }
function SetRow({ set, type, workspaceId, programId, canPlan, canExecute, onSaved }: { set: StrengthSet | CardioSet; type: 'strength' | 'cardio'; workspaceId: string; programId: string; canPlan: boolean; canExecute: boolean; onSaved: () => Promise<void> }) {
  const strength = type === 'strength', s = set as StrengthSet, c = set as CardioSet;
  const [plan, setPlan] = useState([String(strength ? s.planned_reps ?? '' : c.planned_duration_seconds ?? ''), String(strength ? s.planned_weight ?? '' : c.planned_distance ?? ''), String(strength ? s.target_rir ?? '' : c.target_rpe ?? '')]);
  const [actual, setActual] = useState([String(strength ? s.actual_reps ?? '' : c.actual_duration_seconds ?? ''), String(strength ? s.actual_weight ?? '' : c.actual_distance ?? ''), String(strength ? s.actual_rir ?? '' : c.actual_rpe ?? '')]);
  const [coachNotes, setCoachNotes] = useState(set.coach_notes ?? ''), [athleteNotes, setAthleteNotes] = useState(set.athlete_notes ?? '');
  const [setType, setSetType] = useState(s.set_type ?? 'normal'), [unit, setUnit] = useState(c.distance_unit ?? 'mi');
  const [busy, setBusy] = useState<'plan' | 'actual' | null>(null), [saved, setSaved] = useState<'plan' | 'actual' | null>(null), [error, setError] = useState('');
  async function save(planned: boolean) {
    if (busy) return; setBusy(planned ? 'plan' : 'actual'); setError(''); setSaved(null);
    try {
      if (planned) {
        if (strength) await programsApi.updateStrengthPlan(workspaceId, programId, set.id, { setNumber: set.set_number, setType, plannedReps: number(plan[0]), plannedWeight: number(plan[1]), targetRir: number(plan[2]), coachNotes, version: set.version });
        else await programsApi.updateCardioPlan(workspaceId, programId, set.id, { setNumber: set.set_number, plannedDurationSeconds: number(plan[0]), plannedDistance: number(plan[1]), distanceUnit: plan[1] ? unit : null, targetRpe: number(plan[2]), coachNotes, version: set.version });
      } else {
        if (strength) await programsApi.updateStrengthExecution(workspaceId, programId, set.id, { actualReps: number(actual[0]), actualWeight: number(actual[1]), actualRir: number(actual[2]), athleteNotes, version: set.version });
        else await programsApi.updateCardioExecution(workspaceId, programId, set.id, { actualDurationSeconds: number(actual[0]), actualDistance: number(actual[1]), actualRpe: number(actual[2]), athleteNotes, version: set.version });
      }
      await onSaved(); setSaved(planned ? 'plan' : 'actual');
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }
  const fields = (planned: boolean) => {
    const values = planned ? plan : actual, allowed = planned ? canPlan : canExecute;
    const labels = strength ? ['Reps', 'Weight', 'RIR'] : ['Seconds', `Distance (${unit})`, 'RPE'];
    return <form className={`set-inputs ${planned ? 'planned' : 'executed'}`} onSubmit={(e) => { e.preventDefault(); void save(planned); }}>
      <strong className="mobile-set-label">{planned ? 'Planned' : 'Executed'}</strong><div className="set-values">{values.map((value, index) => <label key={index}><span>{labels[index]}</span><input aria-label={`${planned ? index === 2 ? 'Target' : 'Planned' : 'Actual'} ${strength ? ['reps', 'weight', 'RIR'][index] : ['seconds', 'distance', 'RPE'][index]}`} type="number" min={index === 2 && !strength ? 1 : 0} max={index === 2 && !strength ? 10 : undefined} step={index === 1 ? 'any' : '1'} value={value} placeholder="—" disabled={!allowed || Boolean(busy)} onChange={(e) => { (planned ? setPlan : setActual)(values.map((v, i) => i === index ? e.target.value : v)); setSaved(null); }} /></label>)}</div>
      <label className="set-note"><span>{planned ? 'Coach notes' : 'Athlete notes'}</span><input aria-label={planned ? 'Coach notes' : 'Athlete notes'} placeholder={planned ? 'A cue for this set' : 'How did it feel?'} value={planned ? coachNotes : athleteNotes} disabled={!allowed || Boolean(busy)} onChange={(e) => { if (planned) setCoachNotes(e.target.value); else setAthleteNotes(e.target.value); setSaved(null); }} /></label>
      {allowed && <div className="set-save-row"><button type="submit" className="btn btn-outline btn-sm" disabled={Boolean(busy)}>{busy === (planned ? 'plan' : 'actual') ? 'Saving…' : planned ? 'Save plan' : 'Save results'}</button>{saved === (planned ? 'plan' : 'actual') && <span role="status" className="set-status">Saved</span>}</div>}
    </form>;
  };
  return <div className="set-sheet-group"><div className="set-sheet-row"><span className="set-number">{set.set_number}</span>{fields(true)}{fields(false)}</div>{canPlan && <div className="set-kind"><label>{strength ? 'Set type ' : 'Distance unit '}<select aria-label={strength ? 'Set type' : 'Distance unit'} value={strength ? setType : unit} disabled={Boolean(busy)} onChange={(e) => { if (strength) setSetType(e.target.value as StrengthSet['set_type']); else setUnit(e.target.value as CardioSet['distance_unit'] & string); setSaved(null); }}>{strength ? ['normal','warmup','dropset','failure','rest-pause'].map((t) => <option key={t} value={t}>{t}</option>) : ['mi','km','m'].map((u) => <option key={u} value={u}>{u}</option>)}</select></label><span className="muted">Saved with the plan</span></div>}{error && <div className="alert alert-danger m-3" role="alert">{error}</div>}</div>;
}
