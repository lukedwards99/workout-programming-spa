import { useState, useEffect, useCallback, type FormEvent, type ChangeEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import type {
  CardioExerciseBlock,
  CardioSet,
  Program,
  StrengthExerciseBlock,
  Workout,
  WorkoutExerciseBlock,
  Exercise,
  ExerciseGroupWithCount,
  WorkoutSetType,
  WorkoutTrainingSummary,
} from '../types/domain';
import type { UpdateCardioSetInput, UpdateStrengthSetInput } from '../types/api';
import { activateProgram, deactivateProgram, saveNow } from '../db/databaseService';
import { programsApi } from '../api/programsApi';
import { workoutsApi } from '../api/workoutsApi';
import { exercisesApi } from '../api/exercisesApi';
import { exerciseGroupsApi } from '../api/exerciseGroupsApi';
import { exerciseVariationsApi } from '../api/exerciseVariationsApi';
import { workoutExercisesApi } from '../api/workoutExercisesApi';
import { strengthSetsApi } from '../api/strengthSetsApi';
import { cardioSetsApi } from '../api/cardioSetsApi';
import { summaryApi } from '../api/summaryApi';
import { FormModal, ConfirmModal } from '../components';
import SummaryStatGrid, { buildStatItems } from '../components/summary/SummaryStatGrid';
import SummarySetTypeFilterControls, { useSummarySetTypeFilter } from '../components/summary/SummarySetTypeFilter';

const SET_TYPES = ['warmup', 'normal', 'dropset', 'failure', 'rest-pause'] as const;

interface Alert {
  type: string;
  msg: string;
}

interface PendingRemove {
  blockId: string;
  name: string;
  workoutExerciseId: number;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '';
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function parseDuration(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  if (/^\d+:\d{1,2}$/.test(text)) {
    const [minutes, seconds] = text.split(':').map(Number);
    if (seconds >= 60) throw new Error('Seconds must be between 00 and 59.');
    return minutes * 60 + seconds;
  }
  const minutes = Number(text);
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new Error('Use minutes or minutes:seconds, for example 30 or 12:30.');
  }
  return Math.round(minutes * 60);
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
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<PendingRemove | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workoutSummary, setWorkoutSummary] = useState<WorkoutTrainingSummary | null>(null);
  const { selectedSetTypes } = useSummarySetTypeFilter();

  const load = useCallback(() => {
    const loadedWorkout = workoutsApi.get(id);
    if (!loadedWorkout) {
      setError('Workout not found.');
      return;
    }
    setWorkout(loadedWorkout);
    setExerciseBlocks(workoutsApi.getExercisesWithSets(id));
    setAllExercises(exercisesApi.list(null));
    setAllGroups(exerciseGroupsApi.list());
    setWorkoutSummary(summaryApi.getWorkoutSummary(id, selectedSetTypes));
    setError(null);
  }, [id, selectedSetTypes]);

  useEffect(() => {
    const pid = Number(programId);
    const loadedProgram = programsApi.get(pid);
    if (!loadedProgram) {
      setError('Program not found.');
      return;
    }
    setProgram(loadedProgram);
    activateProgram(pid)
      .then(() => load())
      .catch((caught: Error) => setError(caught.message));

    return () => {
      deactivateProgram().catch(console.error);
    };
  }, [programId, workoutId, load]);

  useEffect(() => {
    const variations: Record<number, import('../types/domain').ExerciseVariation[]> = {};
    allExercises.forEach((exercise) => {
      variations[exercise.id] = exerciseVariationsApi.list(exercise.id) || [];
    });
    setAllVariations(variations);
  }, [allExercises]);

  if (error) return <div className="empty-state"><p>{error}</p></div>;
  if (!workout || !program) return <div className="empty-state"><p>Loading...</p></div>;

  const flash = (type: string, msg: string) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleAddExercise = () => {
    if (!addExId) return;
    const exerciseId = Number(addExId);
    const variationId = addVarId ? Number(addVarId) : null;
    const duplicate = exerciseBlocks.find(
      (block) => block.exercise_id === exerciseId
        && (block.variation_id ?? null) === (variationId ?? null),
    );
    if (duplicate) {
      flash(
        'warn',
        `"${allExercises.find((exercise) => exercise.id === exerciseId)?.name}" is already in this workout${variationId ? ' with that variation' : ''}.`,
      );
      return;
    }

    const exercise = allExercises.find((candidate) => candidate.id === exerciseId);
    if (!exercise) return;
    try {
      workoutExercisesApi.create({
        workoutId: id,
        exerciseId,
        exerciseVariationId: variationId,
        exerciseOrder: workoutExercisesApi.getMaxExerciseOrder(id) + 1,
      });
      flash('success', `"${exercise.name}" added.`);
      setShowAddEx(false);
      setAddGroupId('');
      setAddExId('');
      setAddVarId('');
      load();
    } catch (caught) {
      flash('danger', `Could not add exercise: ${(caught as Error).message}`);
    }
  };

  const handleAddSet = (block: WorkoutExerciseBlock) => {
    const setNumber = block.sets.length + 1;
    if (block.exercise_type === 'cardio') {
      cardioSetsApi.create({ workoutExerciseId: block.workout_exercise_id, setNumber });
    } else {
      strengthSetsApi.create({
        workoutExerciseId: block.workout_exercise_id,
        setNumber,
        setType: 'normal',
      });
    }
    load();
  };

  const handleUpdateStrengthSet = (
    setId: number,
    field: keyof UpdateStrengthSetInput,
    value: string,
  ) => {
    const numericFields = ['planned_reps', 'actual_reps', 'weight', 'rir', 'set_number'];
    const changes: Record<string, string | number | null> = {};
    if (value === '') changes[field] = null;
    else if (numericFields.includes(field)) changes[field] = Number(value);
    else changes[field] = value;
    try {
      strengthSetsApi.update(setId, changes as UpdateStrengthSetInput);
      load();
    } catch (caught) {
      flash('danger', `Could not update set: ${(caught as Error).message}`);
    }
  };

  const handleUpdateCardioSet = (
    set: CardioSet,
    field: keyof UpdateCardioSetInput,
    value: string,
  ) => {
    const changes: UpdateCardioSetInput = {};
    if (value === '') {
      (changes as Record<string, unknown>)[field] = null;
    } else if (field === 'distance_unit' || field === 'notes') {
      (changes as Record<string, unknown>)[field] = value;
    } else {
      (changes as Record<string, unknown>)[field] = Number(value);
    }
    if (
      (field === 'planned_distance' || field === 'actual_distance')
      && value !== ''
      && set.distance_unit == null
    ) {
      changes.distance_unit = 'mi';
    }
    try {
      cardioSetsApi.update(set.id, changes);
      load();
    } catch (caught) {
      flash('danger', `Could not update cardio set: ${(caught as Error).message}`);
    }
  };

  const handleUpdateDuration = (
    set: CardioSet,
    field: 'planned_duration_seconds' | 'actual_duration_seconds',
    value: string,
    input: HTMLInputElement,
  ) => {
    try {
      const seconds = parseDuration(value);
      cardioSetsApi.update(set.id, { [field]: seconds });
      load();
    } catch (caught) {
      input.value = formatDuration(set[field]);
      flash('danger', (caught as Error).message);
    }
  };

  const handleDeleteSet = (block: WorkoutExerciseBlock, setId: number) => {
    if (block.exercise_type === 'cardio') {
      cardioSetsApi.delete(setId);
      cardioSetsApi.renumber(block.workout_exercise_id);
    } else {
      strengthSetsApi.delete(setId);
      strengthSetsApi.renumber(block.workout_exercise_id);
    }
    load();
  };

  const handleRemoveExercise = (block: WorkoutExerciseBlock) => {
    setPendingRemove({
      blockId: block.blockId,
      name: block.exercise_name,
      workoutExerciseId: block.workout_exercise_id,
    });
    setShowRemoveConfirm(true);
  };

  const confirmRemove = () => {
    if (!pendingRemove) return;
    workoutExercisesApi.delete(pendingRemove.workoutExerciseId);
    flash('success', `"${pendingRemove.name}" removed.`);
    load();
  };

  const handleMoveSet = (block: WorkoutExerciseBlock, setId: number, direction: number) => {
    const index = block.sets.findIndex((set) => set.id === setId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= block.sets.length) return;
    const targetId = block.sets[targetIndex].id;
    if (block.exercise_type === 'cardio') cardioSetsApi.swapOrder(setId, targetId);
    else strengthSetsApi.swapOrder(setId, targetId);
    load();
  };

  const handleMoveExercise = async (blockId: string, direction: number) => {
    const currentIndex = exerciseBlocks.findIndex((block) => block.blockId === blockId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= exerciseBlocks.length) return;

    try {
      workoutExercisesApi.swapOrder(
        exerciseBlocks[currentIndex].workout_exercise_id,
        exerciseBlocks[targetIndex].workout_exercise_id,
      );
      await saveNow();
      load();
    } catch (caught) {
      flash('danger', `Could not reorder exercises: ${(caught as Error).message}`);
    }
  };

  const noteKey = (exerciseType: 'strength' | 'cardio', setId: number) =>
    `${exerciseType}-${setId}`;

  const toggleNote = (exerciseType: 'strength' | 'cardio', setId: number) => {
    const key = noteKey(exerciseType, setId);
    setExpandedNotes((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filteredExercises = addGroupId
    ? allExercises.filter((exercise) => exercise.exercise_group_id === Number(addGroupId))
    : [];

  const renderStrengthBlock = (block: StrengthExerciseBlock) => (
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
          {block.sets.map((set, index, sets) => {
            const key = noteKey('strength', set.id);
            return (
              <tr className="workout-set-row strength-set-row" key={set.id}>
                <td className="set-number-cell" data-label="Set">{set.set_number}</td>
                <td className="set-type-cell" data-label="Type">
                  <select
                    value={set.set_type}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                      handleUpdateStrengthSet(set.id, 'set_type', event.target.value)}
                    className="set-type-select"
                  >
                    {SET_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </td>
                <td className="set-planned-reps-cell" data-label="Planned Reps">
                  <input type="number" min={0} value={set.planned_reps ?? ''} placeholder="—"
                    onChange={(event) => handleUpdateStrengthSet(set.id, 'planned_reps', event.target.value)} />
                </td>
                <td className="set-actual-reps-cell" data-label="Actual Reps">
                  <input type="number" min={0} value={set.actual_reps ?? ''} placeholder="—"
                    onChange={(event) => handleUpdateStrengthSet(set.id, 'actual_reps', event.target.value)} />
                </td>
                <td className="set-weight-cell" data-label="Weight">
                  <input type="number" min={0} value={set.weight ?? ''} placeholder="—" step="any"
                    onChange={(event) => handleUpdateStrengthSet(set.id, 'weight', event.target.value)} />
                </td>
                <td className="set-rir-cell" data-label="RIR">
                  <input type="number" value={set.rir ?? ''} placeholder="—"
                    onChange={(event) => handleUpdateStrengthSet(set.id, 'rir', event.target.value)} />
                </td>
                <td className="set-notes-cell" data-label="Notes">
                  {expandedNotes.has(key) ? (
                    <>
                      <textarea
                        className="notes-expanded"
                        value={set.notes || ''}
                        onChange={(event) => handleUpdateStrengthSet(set.id, 'notes', event.target.value)}
                        placeholder="Notes..."
                        rows={3}
                      />
                      <button className="notes-collapse" onClick={() => toggleNote('strength', set.id)}>Done</button>
                    </>
                  ) : (
                    <button
                      className={`notes-toggle${set.notes ? ' has-note' : ''}`}
                      onClick={() => toggleNote('strength', set.id)}
                    >
                      {set.notes || '+ note'}
                    </button>
                  )}
                </td>
                <td className="set-actions-cell" data-label="Actions">
                  <span className="set-move-btns">
                    <button className="btn btn-xs btn-outline" disabled={index === 0} onClick={() => handleMoveSet(block, set.id, -1)}>▲</button>
                    <button className="btn btn-xs btn-outline" disabled={index === sets.length - 1} onClick={() => handleMoveSet(block, set.id, 1)}>▼</button>
                  </span>
                  <button className="btn btn-danger btn-xs" onClick={() => handleDeleteSet(block, set.id)}>&times;</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderCardioBlock = (block: CardioExerciseBlock) => (
    <div className="table-responsive">
      <table className="set-table cardio-set-table responsive-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Planned Duration</th>
            <th>Actual Duration</th>
            <th>Planned Distance</th>
            <th>Actual Distance</th>
            <th>Unit</th>
            <th>Target RPE</th>
            <th>Actual RPE</th>
            <th>Notes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {block.sets.map((set, index, sets) => {
            const key = noteKey('cardio', set.id);
            return (
              <tr className="workout-set-row cardio-set-row" key={set.id}>
                <td className="set-number-cell" data-label="Set">{set.set_number}</td>
                <td className="cardio-duration-cell" data-label="Planned Duration">
                  <input
                    type="text"
                    inputMode="decimal"
                    defaultValue={formatDuration(set.planned_duration_seconds)}
                    placeholder="30:00"
                    aria-label="Planned Duration"
                    onBlur={(event) => handleUpdateDuration(
                      set,
                      'planned_duration_seconds',
                      event.target.value,
                      event.currentTarget,
                    )}
                  />
                </td>
                <td className="cardio-duration-cell" data-label="Actual Duration">
                  <input
                    type="text"
                    inputMode="decimal"
                    defaultValue={formatDuration(set.actual_duration_seconds)}
                    placeholder="—"
                    aria-label="Actual Duration"
                    onBlur={(event) => handleUpdateDuration(
                      set,
                      'actual_duration_seconds',
                      event.target.value,
                      event.currentTarget,
                    )}
                  />
                </td>
                <td className="cardio-distance-cell" data-label="Planned Distance">
                  <input type="number" min={0} step="any" value={set.planned_distance ?? ''} placeholder="—"
                    aria-label="Planned Distance"
                    onChange={(event) => handleUpdateCardioSet(set, 'planned_distance', event.target.value)} />
                </td>
                <td className="cardio-distance-cell" data-label="Actual Distance">
                  <input type="number" min={0} step="any" value={set.actual_distance ?? ''} placeholder="—"
                    aria-label="Actual Distance"
                    onChange={(event) => handleUpdateCardioSet(set, 'actual_distance', event.target.value)} />
                </td>
                <td className="cardio-unit-cell" data-label="Unit">
                  <select
                    value={set.distance_unit ?? 'mi'}
                    aria-label="Distance Unit"
                    onChange={(event) => handleUpdateCardioSet(set, 'distance_unit', event.target.value)}
                  >
                    <option value="mi">mi</option>
                    <option value="km">km</option>
                    <option value="m">m</option>
                  </select>
                </td>
                <td className="cardio-rpe-cell" data-label="Target RPE">
                  <input type="number" min={1} max={10} value={set.target_rpe ?? ''} placeholder="—"
                    aria-label="Target RPE"
                    onChange={(event) => handleUpdateCardioSet(set, 'target_rpe', event.target.value)} />
                </td>
                <td className="cardio-rpe-cell" data-label="Actual RPE">
                  <input type="number" min={1} max={10} value={set.actual_rpe ?? ''} placeholder="—"
                    aria-label="Actual RPE"
                    onChange={(event) => handleUpdateCardioSet(set, 'actual_rpe', event.target.value)} />
                </td>
                <td className="set-notes-cell" data-label="Notes">
                  {expandedNotes.has(key) ? (
                    <>
                      <textarea
                        className="notes-expanded"
                        value={set.notes || ''}
                        onChange={(event) => handleUpdateCardioSet(set, 'notes', event.target.value)}
                        placeholder="Notes..."
                        rows={3}
                      />
                      <button className="notes-collapse" onClick={() => toggleNote('cardio', set.id)}>Done</button>
                    </>
                  ) : (
                    <button
                      className={`notes-toggle${set.notes ? ' has-note' : ''}`}
                      onClick={() => toggleNote('cardio', set.id)}
                    >
                      {set.notes || '+ note'}
                    </button>
                  )}
                </td>
                <td className="set-actions-cell" data-label="Actions">
                  <span className="set-move-btns">
                    <button className="btn btn-xs btn-outline" disabled={index === 0} onClick={() => handleMoveSet(block, set.id, -1)}>▲</button>
                    <button className="btn btn-xs btn-outline" disabled={index === sets.length - 1} onClick={() => handleMoveSet(block, set.id, 1)}>▼</button>
                  </span>
                  <button className="btn btn-danger btn-xs" onClick={() => handleDeleteSet(block, set.id)}>&times;</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

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

      <FormModal
        show={showAddEx}
        onHide={() => setShowAddEx(false)}
        title="Add Exercise"
        onSubmit={(event: FormEvent) => { event.preventDefault(); handleAddExercise(); }}
        submitLabel="Add"
      >
        <div className="form-group">
          <label>Exercise Group</label>
          <select value={addGroupId} onChange={(event: ChangeEvent<HTMLSelectElement>) => {
            setAddGroupId(event.target.value);
            setAddExId('');
            setAddVarId('');
          }}>
            <option value="">-- Select group --</option>
            {allGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
        </div>
        {addGroupId && (
          <div className="form-group">
            <label>Exercise</label>
            <select value={addExId} onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              setAddExId(event.target.value);
              setAddVarId('');
            }}>
              <option value="">-- Select exercise --</option>
              {filteredExercises.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>{exercise.name}</option>
              ))}
            </select>
            {addExId && (
              <small style={{ color: 'var(--text-muted)' }}>
                Type: {allExercises.find((exercise) => exercise.id === Number(addExId))?.exercise_type === 'cardio'
                  ? 'Cardio'
                  : 'Strength'}
              </small>
            )}
          </div>
        )}
        <div className="form-group">
          <label>Variation (optional)</label>
          <select value={addVarId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setAddVarId(event.target.value)}>
            <option value="">-- None --</option>
            {(allVariations[addExId ? Number(addExId) : 0] || []).map((variation) => (
              <option key={variation.id} value={variation.id}>{variation.name}</option>
            ))}
          </select>
        </div>
      </FormModal>

      {exerciseBlocks.length === 0 ? (
        <div className="empty-state"><p>No exercises yet. Click “+ Add Exercise” to get started.</p></div>
      ) : (
        exerciseBlocks.map((block, blockIndex) => (
          <div className={`exercise-block ${block.exercise_type}-exercise-block`} key={block.blockId}>
            <div className="exercise-header">
              <div>
                <h3>
                  {block.exercise_name}
                  {block.variation_name && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> — {block.variation_name}</span>}
                </h3>
                <span className={`exercise-type-badge exercise-type-${block.exercise_type}`}>
                  {block.exercise_type === 'cardio' ? 'Cardio' : 'Strength'}
                </span>
                <div className="meta">
                  {block.exercise_type === 'cardio'
                    ? `${block.sets.length} cardio set${block.sets.length === 1 ? '' : 's'}`
                    : `${block.sets.filter((set) => set.set_type !== 'warmup').length} working sets`}
                </div>
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
                <button className="btn btn-outline btn-sm" onClick={() => handleAddSet(block)}>+ Set</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleRemoveExercise(block)}>&times;</button>
              </div>
            </div>
            <div className="exercise-body">
              {block.exercise_type === 'cardio'
                ? renderCardioBlock(block)
                : renderStrengthBlock(block)}
              <div style={{ marginTop: 8 }}>
                <button className="btn btn-outline btn-sm" onClick={() => handleAddSet(block)}>+ Add Set</button>
              </div>
            </div>
          </div>
        ))
      )}

      {workoutSummary && (
        <div style={{ marginTop: 24 }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>
            Strength programmed statistics &mdash; cardio exercises are not included.
          </p>
          <SummarySetTypeFilterControls />
          <SummaryStatGrid
            stats={buildStatItems(workoutSummary.totals)}
            caption="Workout strength training summary"
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
