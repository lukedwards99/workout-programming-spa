import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { workoutsApi } from '../api/workoutsApi';
import { mesocyclesApi } from '../api/mesocyclesApi';
import { exercisesApi } from '../api/exercisesApi';
import { exerciseGroupsApi } from '../api/exerciseGroupsApi';
import { exerciseVariationsApi } from '../api/exerciseVariationsApi';
import { workoutSetsApi } from '../api/workoutSetsApi';
import { FormModal, ConfirmModal } from '../components';

const SET_TYPES = ['warmup', 'normal', 'dropset', 'failure'];

function setBadgeClass(type) {
  const map = { warmup: 'badge-warmup', normal: 'badge-normal', dropset: 'badge-dropset', failure: 'badge-failure' };
  return map[type] || 'badge-normal';
}

export default function WorkoutPage() {
  const { workoutId } = useParams();
  const id = Number(workoutId);
  const [workout, setWorkout] = useState(null);
  const [exerciseBlocks, setExerciseBlocks] = useState([]);
  const [allExercises, setAllExercises] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [allVariations, setAllVariations] = useState({});
  const [alert, setAlert] = useState(null);
  const [showAddEx, setShowAddEx] = useState(false);
  const [addGroupId, setAddGroupId] = useState('');
  const [addExId, setAddExId] = useState('');
  const [addVarId, setAddVarId] = useState('');
  const [expandedEx, setExpandedEx] = useState(null);
  const [expandedNotes, setExpandedNotes] = useState(new Set());
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [pendingRemove, setPendingRemove] = useState(null);

  const load = useCallback(() => {
    const w = workoutsApi.get(id);
    if (!w) return;
    setWorkout(w);
    setExerciseBlocks(workoutsApi.getExercisesWithSets(id));
    const meso = mesocyclesApi.get(w.mesocycle_id);
    if (meso) {
      setAllExercises(exercisesApi.list(meso.program_id, null));
      setAllGroups(exerciseGroupsApi.list(meso.program_id));
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const vars = {};
    allExercises.forEach((e) => {
      vars[e.id] = exerciseVariationsApi.list(e.id) || [];
    });
    setAllVariations(vars);
  }, [allExercises]);

  if (!workout) return <div className="empty-state"><p>Workout not found.</p></div>;

  const flash = (type, msg) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleAddExercise = () => {
    if (!addExId) return;
    const exId = Number(addExId);
    const varId = addVarId ? Number(addVarId) : null;
    const dup = exerciseBlocks.find((b) => b.exercise_id === exId && (b.variation_id ?? null) === (varId ?? null));
    if (dup) {
      flash('warn', `"${allExercises.find((e) => e.id === exId).name}" is already in this workout${varId ? ' with that variation' : ''}.`);
      return;
    }
    const exOrder = workoutSetsApi.getMaxExerciseOrder(id) + 1;
    const ex = allExercises.find((e) => e.id === exId);
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

  const handleAddSet = (blockId, type) => {
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

  const handleUpdateSet = (setId, field, value) => {
    const numericFields = ['reps', 'weight', 'rir', 'set_number'];
    const s = {};
    if (value === '') {
      s[field] = null;
    } else if (numericFields.includes(field)) {
      s[field] = Number(value);
    } else {
      s[field] = value;
    }
    workoutSetsApi.update(setId, s);
    load();
  };

  const handleDeleteSet = (setId) => {
    const set = workoutSetsApi.get(setId);
    if (set) {
      workoutSetsApi.delete(setId);
      workoutSetsApi.renumber(id, set.exercise_id, set.exercise_variation_id ?? null);
    }
    load();
  };

  const handleRemoveExercise = (blockId) => {
    const block = exerciseBlocks.find((b) => b.blockId === blockId);
    if (!block) return;
    setPendingRemove({ blockId, name: block.exercise_name, exerciseId: block.exercise_id, variationId: block.variation_id || null });
    setShowRemoveConfirm(true);
  };

  const confirmRemove = () => {
    workoutSetsApi.deleteByExercise(id, pendingRemove.exerciseId, pendingRemove.variationId);
    flash('success', `"${pendingRemove.name}" removed.`);
    load();
  };

  const handleMoveSet = (setId, direction) => {
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

  const toggleNote = (setId) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      next.has(setId) ? next.delete(setId) : next.add(setId);
      return next;
    });
  };

  const filteredExercises = addGroupId
    ? allExercises.filter((e) => e.exercise_group_id === Number(addGroupId))
    : [];

  const workingSets = exerciseBlocks.reduce((sum, b) => sum + b.sets.filter((s) => s.set_type !== 'warmup').length, 0);
  const totalVolume = exerciseBlocks.reduce((sum, b) =>
    sum + b.sets.filter((s) => s.set_type !== 'warmup').reduce((s2, s) => s2 + ((s.reps || 0) * (s.weight || 0)), 0), 0
  );

  return (
    <>
      <div className="breadcrumb">
        <Link to="/">Programs</Link><span>/</span>
        <Link to={`/mesocycles/${workout.mesocycle_id}`}>Mesocycle</Link><span>/</span>
        <strong>{workout.name}</strong>
      </div>

      <div className="page-header">
        <h1>{workout.name}</h1>
        <button className="btn btn-primary" onClick={() => setShowAddEx(true)}>+ Add Exercise</button>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      <FormModal show={showAddEx} onHide={() => setShowAddEx(false)} title="Add Exercise" onSubmit={(e) => { e.preventDefault(); handleAddExercise(); }} submitLabel="Add">
        <div className="form-group">
          <label>Muscle Group</label>
          <select value={addGroupId} onChange={(e) => {
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
            <select value={addExId} onChange={(e) => setAddExId(e.target.value)}>
              <option value="">-- Select exercise --</option>
              {filteredExercises.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
            </select>
          </div>
        )}
        <div className="form-group">
          <label>Variation (optional)</label>
          <select value={addVarId} onChange={(e) => setAddVarId(e.target.value)}>
            <option value="">-- None --</option>
            {(allVariations[addExId] || []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
      </FormModal>

      {exerciseBlocks.length === 0 ? (
        <div className="empty-state"><p>No exercises yet. Click "+ Add Exercise" to get started.</p></div>
      ) : (
        exerciseBlocks.sort((a, b) => a.exercise_order - b.exercise_order).map((block) => (
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
                    <th>Reps</th>
                    <th>Weight</th>
                    <th>RIR</th>
                    <th>Notes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {block.sets.map((s, i, arr) => (
                    <tr key={s.id}>
                      <td data-label="Set">{s.set_number}</td>
                      <td data-label="Type">
                        <select
                          value={s.set_type}
                          onChange={(e) => handleUpdateSet(s.id, 'set_type', e.target.value)}
                          className="set-type-select"
                        >
                          {SET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td data-label="Reps">
                        <input type="number" value={s.reps ?? ''} placeholder="—"
                          onChange={(e) => handleUpdateSet(s.id, 'reps', e.target.value)} />
                      </td>
                      <td data-label="Weight">
                        <input type="number" value={s.weight ?? ''} placeholder="—" step="any"
                          onChange={(e) => handleUpdateSet(s.id, 'weight', e.target.value)} />
                      </td>
                      <td data-label="RIR">
                        <input type="number" value={s.rir ?? ''} placeholder="—"
                          onChange={(e) => handleUpdateSet(s.id, 'rir', e.target.value)} />
                      </td>
                      <td data-label="Notes">
                        {expandedNotes.has(s.id) ? (
                          <>
                            <textarea
                              className="notes-expanded"
                              value={s.notes || ''}
                              onChange={(e) => handleUpdateSet(s.id, 'notes', e.target.value)}
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
                      <td data-label="Actions">
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

      {exerciseBlocks.length > 0 && (
        <div className="totals-bar">
          <div className="total-item"><div className="val">{exerciseBlocks.length}</div><div className="lbl">Exercises</div></div>
          <div className="total-item"><div className="val">{workingSets}</div><div className="lbl">Working Sets</div></div>
          <div className="total-item"><div className="val">{totalVolume.toLocaleString()}</div><div className="lbl">Total Volume</div></div>
        </div>
      )}

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
