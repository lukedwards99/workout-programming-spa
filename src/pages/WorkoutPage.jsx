import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { workoutsApi } from '../api/workoutsApi';
import { mesocyclesApi } from '../api/mesocyclesApi';
import { exercisesApi } from '../api/exercisesApi';
import { exerciseVariationsApi } from '../api/exerciseVariationsApi';
import { workoutSetsApi } from '../api/workoutSetsApi';

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
  const [allVariations, setAllVariations] = useState({}); // exerciseId -> variations[]
  const [alert, setAlert] = useState(null);
  const [showAddEx, setShowAddEx] = useState(false);
  const [addExId, setAddExId] = useState('');
  const [addVarId, setAddVarId] = useState('');
  const [expandedEx, setExpandedEx] = useState(null);

  const load = useCallback(() => {
    const w = workoutsApi.get(id);
    if (!w) return;
    setWorkout(w);
    setExerciseBlocks(workoutsApi.getExercisesWithSets(id));
    const meso = mesocyclesApi.get(w.mesocycle_id);
    setAllExercises(meso ? exercisesApi.list(meso.program_id, null) : []);
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
    if (!block || !window.confirm(`Remove "${block.exercise_name}" from this workout?`)) return;
    workoutSetsApi.deleteByExercise(id, block.exercise_id, block.variation_id || null);
    flash('success', `"${block.exercise_name}" removed.`);
    load();
  };

  // Derived totals
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

      {showAddEx && (
        <div className="modal-overlay" onClick={() => setShowAddEx(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h2>Add Exercise</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleAddExercise(); }}>
              <div className="form-group">
                <label>Exercise</label>
                <select value={addExId} onChange={(e) => setAddExId(e.target.value)}>
                  <option value="">-- Select exercise --</option>
                  {allExercises.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Variation (optional)</label>
                <select value={addVarId} onChange={(e) => setAddVarId(e.target.value)}>
                  <option value="">-- None --</option>
                  {(allVariations[addExId] || []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddEx(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              <table className="set-table">
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
                  {block.sets.map((s) => (
                    <tr key={s.id}>
                      <td>{s.set_number}</td>
                      <td><span className={`badge ${setBadgeClass(s.set_type)}`}>{s.set_type}</span></td>
                      <td>
                        <input type="number" value={s.reps ?? ''} placeholder="—"
                          onChange={(e) => handleUpdateSet(s.id, 'reps', e.target.value)} />
                      </td>
                      <td>
                        <input type="number" value={s.weight ?? ''} placeholder="—" step="any"
                          onChange={(e) => handleUpdateSet(s.id, 'weight', e.target.value)} />
                      </td>
                      <td>
                        <input type="number" value={s.rir ?? ''} placeholder="—"
                          onChange={(e) => handleUpdateSet(s.id, 'rir', e.target.value)} />
                      </td>
                      <td>
                        <input className="notes-inp" value={s.notes || ''} placeholder="—"
                          onChange={(e) => handleUpdateSet(s.id, 'notes', e.target.value)} />
                      </td>
                      <td>
                        <button className="btn btn-danger btn-xs" onClick={() => handleDeleteSet(s.id)}>&times;</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <div style={{ marginTop: 8 }}>
                <select
                  onChange={(e) => { if (e.target.value) { handleAddSet(block.blockId, e.target.value); e.target.value = ''; } }}
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '4px 8px', fontSize: 12 }}
                >
                  <option value="">+ Add set (type)...</option>
                  {SET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
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
    </>
  );
}
