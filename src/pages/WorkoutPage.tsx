import { useState, useEffect, useCallback, type FormEvent, type ChangeEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Program, Workout, WorkoutSetWithNames, WorkoutExerciseBlock, Exercise, ExerciseGroupWithCount, WorkoutSetType, WorkoutTrainingSummary } from '../types/domain';
import type { UpdateWorkoutSetInput } from '../types/api';
import { activateProgram, deactivateProgram, saveNow } from '../db/databaseService';
import { programsApi } from '../api/programsApi';
import { workoutsApi } from '../api/workoutsApi';
import { exercisesApi } from '../api/exercisesApi';
import { exerciseGroupsApi } from '../api/exerciseGroupsApi';
import { exerciseVariationsApi } from '../api/exerciseVariationsApi';
import { workoutSetsApi } from '../api/workoutSetsApi';
import { summaryApi } from '../api/summaryApi';
import { FormModal, ConfirmModal } from '../components';
import SummaryStatGrid, { buildStatItems } from '../components/summary/SummaryStatGrid';
import SummarySetTypeFilterControls, { useSummarySetTypeFilter } from '../components/summary/SummarySetTypeFilter';

const SET_TYPES = ['warmup', 'normal', 'dropset', 'failure', 'rest-pause'] as const;

function setBadgeClass(type: string): string {
  const map: Record<string, string> = { warmup: 'badge-warmup', normal: 'badge-normal', dropset: 'badge-dropset', failure: 'badge-failure', 'rest-pause': 'badge-rest-pause' };
  return map[type] || 'badge-normal';
}

interface Alert {
  type: string;
  msg: string;
}

interface PendingRemove {
  blockId: string;
  name: string;
  exerciseId: number;
  variationId: number | null;
}

export default function WorkoutPage() {
  const { programId, workoutId } = useParams<{ programId: string; workoutId: string }>();
  const id = Number(workoutId);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exerciseBlocks, setExerciseBlocks] = useState<WorkoutExerciseBlock[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [allGroups, setAllGroups] = useState<ExerciseGroupWithCount[]>([]);
  const [allVariations, setAllVariations] = useState<Record<number, import('../types/domain').ExerciseVariation[]>>({});
  const [program, setProgram] = useState<Program | null>(null);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [showAddEx, setShowAddEx] = useState(false);
  const [addGroupId, setAddGroupId] = useState('');
  const [addExId, setAddExId] = useState('');
  const [addVarId, setAddVarId] = useState('');
  const [expandedEx, setExpandedEx] = useState<string | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<PendingRemove | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workoutSummary, setWorkoutSummary] = useState<WorkoutTrainingSummary | null>(null);
  const { selectedSetTypes } = useSummarySetTypeFilter();

  const load = useCallback(() => {
    const w = workoutsApi.get(id);
    if (!w) {
      setError('Workout not found.');
      return;
    }
    setWorkout(w);
    setExerciseBlocks(workoutsApi.getExercisesWithSets(id));
    setAllExercises(exercisesApi.list(null));
    setAllGroups(exerciseGroupsApi.list());
    setWorkoutSummary(summaryApi.getWorkoutSummary(id, selectedSetTypes));
    setError(null);
  }, [id, selectedSetTypes]);

  useEffect(() => {
    const pid = Number(programId);
    const p = programsApi.get(pid);
    if (!p) {
      setError('Program not found.');
      return;
    }
    setProgram(p);
    activateProgram(pid)
      .then(() => load())
      .catch((e: Error) => setError(e.message));

    return () => {
      deactivateProgram().catch(console.error);
    };
  }, [programId, workoutId, load]);

  useEffect(() => {
    const vars: Record<number, import('../types/domain').ExerciseVariation[]> = {};
    allExercises.forEach((e) => {
      vars[e.id] = exerciseVariationsApi.list(e.id) || [];
    });
    setAllVariations(vars);
  }, [allExercises]);

  if (error) return <div className="empty-state"><p>{error}</p></div>;
  if (!workout || !program) return <div className="empty-state"><p>Loading...</p></div>;

  const flash = (type: string, msg: string) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleAddExercise = () => {
    if (!addExId) return;
    const exId = Number(addExId);
    const varId = addVarId ? Number(addVarId) : null;
    const dup = exerciseBlocks.find((b) => b.exercise_id === exId && (b.variation_id ?? null) === (varId ?? null));
    if (dup) {
      flash('warn', `"${allExercises.find((e) => e.id === exId)?.name}" is already in this workout${varId ? ' with that variation' : ''}.`);
      return;
    }
    const exOrder = workoutSetsApi.getMaxExerciseOrder(id) + 1;
    const ex = allExercises.find((e) => e.id === exId);
    if (!ex) return;
    workoutSetsApi.create({
      workoutId: id,
      exerciseId: exId,
      exerciseVariationId: varId,
      exerciseOrder: exOrder,
      setNumber: 1,
      setType: 'normal',
    });
    flash('success', `"${ex.name}" added.`);
    setShowAddEx(false);
    setAddGroupId('');
    setAddExId('');
    setAddVarId('');
    load();
  };

  const handleAddSet = (blockId: string, type: WorkoutSetType) => {
    const block = exerciseBlocks.find((b) => b.blockId === blockId);
    const setNum = block ? block.sets.length + 1 : 1;
    workoutSetsApi.create({
      workoutId: id,
      exerciseId: block ? block.exercise_id : 0,
      exerciseVariationId: block ? block.variation_id : null,
      exerciseOrder: block ? block.exercise_order : 1,
      setNumber: setNum,
      setType: type || 'normal',
    });
    load();
  };

  const handleUpdateSet = (setId: number, field: string, value: string) => {
    const numericFields = ['planned_reps', 'actual_reps', 'weight', 'rir', 'set_number'];
    const s: Record<string, string | number | null> = {};
    if (value === '') {
      s[field] = null;
    } else if (numericFields.includes(field)) {
      s[field] = Number(value);
    } else {
      s[field] = value;
    }
    workoutSetsApi.update(setId, s as UpdateWorkoutSetInput);
    load();
  };

  const handleDeleteSet = (setId: number) => {
    const set = workoutSetsApi.get(setId);
    if (set) {
      workoutSetsApi.delete(setId);
      workoutSetsApi.renumber(id, set.exercise_id, set.exercise_variation_id ?? null);
    }
    load();
  };

  const handleRemoveExercise = (blockId: string) => {
    const block = exerciseBlocks.find((b) => b.blockId === blockId);
    if (!block) return;
    setPendingRemove({ blockId, name: block.exercise_name, exerciseId: block.exercise_id, variationId: block.variation_id || null });
    setShowRemoveConfirm(true);
  };

  const confirmRemove = () => {
    if (!pendingRemove) return;
    workoutSetsApi.deleteByExercise(id, pendingRemove.exerciseId, pendingRemove.variationId);
    flash('success', `"${pendingRemove.name}" removed.`);
    load();
  };

  const handleMoveSet = (setId: number, direction: number) => {
    for (const block of exerciseBlocks) {
      const idx = block.sets.findIndex((s) => s.id === setId);
      if (idx === -1) continue;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= block.sets.length) return;
      const a = block.sets[idx];
      const b = block.sets[newIdx];
      workoutSetsApi.update(a.id, { set_number: b.set_number });
      workoutSetsApi.update(b.id, { set_number: a.set_number });
      load();
      return;
    }
  };

  const handleMoveExercise = async (blockId: string, direction: number) => {
    const currentIndex = exerciseBlocks.findIndex((block) => block.blockId === blockId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= exerciseBlocks.length) return;

    const current = exerciseBlocks[currentIndex];
    const target = exerciseBlocks[targetIndex];
    try {
      workoutSetsApi.swapExerciseOrder(
        id,
        {
          exerciseId: current.exercise_id,
          exerciseVariationId: current.variation_id,
          exerciseOrder: current.exercise_order,
        },
        {
          exerciseId: target.exercise_id,
          exerciseVariationId: target.variation_id,
          exerciseOrder: target.exercise_order,
        }
      );
      await saveNow();
      load();
    } catch (error) {
      flash('danger', `Could not reorder exercises: ${(error as Error).message}`);
    }
  };

  const toggleNote = (setId: number) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      next.has(setId) ? next.delete(setId) : next.add(setId);
      return next;
    });
  };

  const filteredExercises = addGroupId
    ? allExercises.filter((e) => e.exercise_group_id === Number(addGroupId))
    : [];

  return (
    <>
      <div className="breadcrumb">
        <Link to="/">Programs</Link><span>/</span>
        <Link to={`/programs/${program.id}/mesocycles/${workout.mesocycle_id}`}>Mesocycle</Link><span>/</span>
        <strong>{workout.name}</strong>
      </div>

      <div className="page-header">
        <h1>{workout.name}</h1>
        <button className="btn btn-primary" onClick={() => setShowAddEx(true)}>+ Add Exercise</button>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      <FormModal show={showAddEx} onHide={() => setShowAddEx(false)} title="Add Exercise" onSubmit={(e: FormEvent) => { e.preventDefault(); handleAddExercise(); }} submitLabel="Add">
        <div className="form-group">
          <label>Muscle Group</label>
          <select value={addGroupId} onChange={(e: ChangeEvent<HTMLSelectElement>) => {
            setAddGroupId(e.target.value);
            setAddExId('');
            setAddVarId('');
          }}>
            <option value="">-- Select group --</option>
            {allGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        {addGroupId && (
          <div className="form-group">
            <label>Exercise</label>
            <select value={addExId} onChange={(e: ChangeEvent<HTMLSelectElement>) => setAddExId(e.target.value)}>
              <option value="">-- Select exercise --</option>
              {filteredExercises.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
            </select>
          </div>
        )}
        <div className="form-group">
          <label>Variation (optional)</label>
          <select value={addVarId} onChange={(e: ChangeEvent<HTMLSelectElement>) => setAddVarId(e.target.value)}>
            <option value="">-- None --</option>
            {(allVariations[addExId ? Number(addExId) : 0] || []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
      </FormModal>

      {exerciseBlocks.length === 0 ? (
        <div className="empty-state"><p>No exercises yet. Click "+ Add Exercise" to get started.</p></div>
      ) : (
        exerciseBlocks.map((block, blockIndex) => (
          <div className="exercise-block" key={block.blockId}>
            <div className="exercise-header">
              <div>
                <h3>
                  {block.exercise_name}
                  {block.variation_name && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> — {block.variation_name}</span>}
                </h3>
                <div className="meta">{block.sets.filter((s) => s.set_type !== 'warmup').length} working sets</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-xs btn-outline"
                  aria-label={`Move ${block.exercise_name} up`}
                  disabled={blockIndex === 0}
                  onClick={() => handleMoveExercise(block.blockId, -1)}
                >▲</button>
                <button
                  className="btn btn-xs btn-outline"
                  aria-label={`Move ${block.exercise_name} down`}
                  disabled={blockIndex === exerciseBlocks.length - 1}
                  onClick={() => handleMoveExercise(block.blockId, 1)}
                >▼</button>
                <button className="btn btn-outline btn-sm" onClick={() => handleAddSet(block.blockId, 'normal')}>+ Set</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleRemoveExercise(block.blockId)}>&times;</button>
              </div>
            </div>
            <div className="exercise-body">
              <div className="table-responsive">
              <table className="set-table responsive-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Type</th>
                    <th>Planned Reps</th>
                    <th>Actual Reps</th>
                    <th>Weight</th>
                    <th>RIR</th>
                    <th>Notes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {block.sets.map((s, i, arr) => (
                    <tr className="workout-set-row" key={s.id}>
                      <td className="set-number-cell" data-label="Set">{s.set_number}</td>
                      <td className="set-type-cell" data-label="Type">
                        <select
                          value={s.set_type}
                          onChange={(e: ChangeEvent<HTMLSelectElement>) => handleUpdateSet(s.id, 'set_type', e.target.value)}
                          className="set-type-select"
                        >
                          {SET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td className="set-planned-reps-cell" data-label="Planned Reps">
                        <input type="number" value={s.planned_reps ?? ''} placeholder="—"
                          onChange={(e: ChangeEvent<HTMLInputElement>) => handleUpdateSet(s.id, 'planned_reps', e.target.value)} />
                      </td>
                      <td className="set-actual-reps-cell" data-label="Actual Reps">
                        <input type="number" value={s.actual_reps ?? ''} placeholder="—"
                          onChange={(e: ChangeEvent<HTMLInputElement>) => handleUpdateSet(s.id, 'actual_reps', e.target.value)} />
                      </td>
                      <td className="set-weight-cell" data-label="Weight">
                        <input type="number" value={s.weight ?? ''} placeholder="—" step="any"
                          onChange={(e: ChangeEvent<HTMLInputElement>) => handleUpdateSet(s.id, 'weight', e.target.value)} />
                      </td>
                      <td className="set-rir-cell" data-label="RIR">
                        <input type="number" value={s.rir ?? ''} placeholder="—"
                          onChange={(e: ChangeEvent<HTMLInputElement>) => handleUpdateSet(s.id, 'rir', e.target.value)} />
                      </td>
                      <td className="set-notes-cell" data-label="Notes">
                        {expandedNotes.has(s.id) ? (
                          <>
                            <textarea
                              className="notes-expanded"
                              value={s.notes || ''}
                              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => handleUpdateSet(s.id, 'notes', e.target.value)}
                              placeholder="Notes..."
                              rows={3}
                            />
                            <button className="notes-collapse" onClick={() => toggleNote(s.id)}>Done</button>
                          </>
                        ) : (
                          <button
                            className={`notes-toggle${s.notes ? ' has-note' : ''}`}
                            onClick={() => toggleNote(s.id)}
                          >
                            {s.notes ? s.notes : '+ note'}
                          </button>
                        )}
                      </td>
                      <td className="set-actions-cell" data-label="Actions">
                        <span className="set-move-btns">
                          <button className="btn btn-xs btn-outline" disabled={i === 0} onClick={() => handleMoveSet(s.id, -1)}>▲</button>
                          <button className="btn btn-xs btn-outline" disabled={i === arr.length - 1} onClick={() => handleMoveSet(s.id, 1)}>▼</button>
                        </span>
                        <button className="btn btn-danger btn-xs" onClick={() => handleDeleteSet(s.id)}>&times;</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <div style={{ marginTop: 8 }}>
                <button className="btn btn-outline btn-sm" onClick={() => handleAddSet(block.blockId, 'normal')}>+ Add Set</button>
              </div>
            </div>
          </div>
        ))
      )}

      {workoutSummary && (
        <div style={{ marginTop: 24 }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>
            Programmed statistics &mdash; calculated from your training plan, not completed sessions.
          </p>
          <SummarySetTypeFilterControls />
          <SummaryStatGrid
            stats={buildStatItems(workoutSummary.totals)}
            caption="Workout training summary"
          />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
        <button className="btn btn-primary" onClick={() => setShowAddEx(true)}>+ Add Exercise</button>
      </div>

      <ConfirmModal
        show={showRemoveConfirm}
        onHide={() => setShowRemoveConfirm(false)}
        onConfirm={confirmRemove}
        title="Remove Exercise"
        message={`Remove "${pendingRemove?.name}" from this workout?`}
        confirmLabel="Remove"
      />
    </>
  );
}
