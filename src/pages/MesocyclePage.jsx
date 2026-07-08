import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { programsApi } from '../api/programsApi';
import { mesocyclesApi } from '../api/mesocyclesApi';
import { workoutsApi } from '../api/workoutsApi';

export default function MesocyclePage() {
  const { mesocycleId } = useParams();
  const [mesocycle, setMesocycle] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [program, setProgram] = useState(null);
  const [alert, setAlert] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [addDay, setAddDay] = useState(0);
  const [woName, setWoName] = useState('');

  const load = useCallback(() => {
    const m = mesocyclesApi.get(Number(mesocycleId));
    if (!m) return;
    setMesocycle(m);
    setWorkouts(workoutsApi.list(m.id));
    setProgram(programsApi.get(m.program_id));
  }, [mesocycleId]);

  useEffect(() => { load(); }, [load]);

  if (!mesocycle) return <div className="empty-state"><p>Mesocycle not found.</p></div>;

  const flash = (type, msg) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleAdd = (e) => {
    e.preventDefault();
    if (!woName.trim()) return;
    workoutsApi.create({
      mesocycleId: mesocycle.id,
      name: woName.trim(),
      dayOffset: addDay,
    });
    flash('success', `"${woName}" added.`);
    setShowModal(false);
    setWoName('');
    load();
  };

  const handleDelete = (id) => {
    const w = workouts.find((x) => x.id === id);
    if (!window.confirm(`Delete "${w.name}"?`)) return;
    workoutsApi.delete(id);
    flash('success', `"${w.name}" deleted.`);
    load();
  };

  const openAdd = (dayOffset) => {
    setAddDay(dayOffset);
    setWoName('');
    setShowModal(true);
  };

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <>
      <div className="breadcrumb">
        <Link to="/">Programs</Link><span>/</span>
        {program && <><Link to={`/programs/${program.id}`}>{program.name}</Link><span>/</span></>}
        <strong>{mesocycle.name}</strong>
      </div>

      <div className="page-header">
        <h1>{mesocycle.name}</h1>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
        Started {new Date(mesocycle.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} &middot; {mesocycle.microcycle_length}-day microcycle
      </p>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      <div className="day-grid" style={{ gridTemplateColumns: `repeat(${mesocycle.microcycle_length}, 1fr)` }}>
        {Array.from({ length: mesocycle.microcycle_length }, (_, i) => {
          const dayWorkouts = workouts.filter((w) => w.day_offset === i);
          return (
            <div className="day-cell" key={i}>
              <div className="day-label">
                <span>{dayNames[i % 7]}</span>
                <span>Day {i + 1}</span>
              </div>
              {dayWorkouts.map((w) => (
                <div key={w.id} style={{ position: 'relative' }}>
                  <Link to={`/workouts/${w.id}`} className="workout-chip">
                    {w.name}
                    <button
                      className="btn btn-xs btn-danger"
                      style={{ float: 'right', marginTop: -1 }}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(w.id); }}
                    >&times;</button>
                  </Link>
                </div>
              ))}
              <button className="add-chip" onClick={() => openAdd(i)}>+ Add workout</button>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h2>Add Workout</h2>
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label>Workout Name</label>
                <input
                  value={woName} onChange={(e) => setWoName(e.target.value)}
                  placeholder={`e.g. ${dayNames[addDay % 7]} Workout`}
                  required autoFocus
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
