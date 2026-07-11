import { useState, useEffect, type FormEvent, type MouseEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Program, Mesocycle, Workout } from '../types/domain';
import { activateProgram, deactivateProgram } from '../db/databaseService';
import { programsApi } from '../api/programsApi';
import { mesocyclesApi } from '../api/mesocyclesApi';
import { workoutsApi } from '../api/workoutsApi';
import { FormModal, ConfirmModal } from '../components';

interface Alert {
  type: string;
  msg: string;
}

interface PendingDelete {
  id: number;
  name: string;
}

export default function MesocyclePage() {
  const { programId, mesocycleId } = useParams<{ programId: string; mesocycleId: string }>();
  const [mesocycle, setMesocycle] = useState<Mesocycle | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [program, setProgram] = useState<Program | null>(null);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [addDay, setAddDay] = useState(0);
  const [woName, setWoName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const pid = Number(programId);
    const p = programsApi.get(pid);
    if (!p) {
      setError('Program not found.');
      return;
    }
    setProgram(p);
    activateProgram(pid)
      .then(() => {
        const m = mesocyclesApi.get(Number(mesocycleId));
        if (!m) {
          setError('Mesocycle not found in this program.');
          return;
        }
        setMesocycle(m);
        setWorkouts(workoutsApi.list(m.id));
        setError(null);
      })
      .catch((e: Error) => setError(e.message));

    return () => {
      deactivateProgram().catch(console.error);
    };
  }, [programId, mesocycleId]);

  if (error) return <div className="empty-state"><p>{error}</p></div>;
  if (!mesocycle) return <div className="empty-state"><p>Loading...</p></div>;

  const flash = (type: string, msg: string) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleAdd = (e: FormEvent<HTMLFormElement>) => {
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
    setWorkouts(workoutsApi.list(mesocycle.id));
  };

  const handleDelete = (id: number) => {
    const w = workouts.find((x) => x.id === id);
    if (!w) return;
    setPendingDelete({ id, name: w.name });
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    workoutsApi.delete(pendingDelete.id);
    flash('success', `"${pendingDelete.name}" deleted.`);
    setWorkouts(workoutsApi.list(mesocycle.id));
  };

  const openAdd = (dayOffset: number) => {
    setAddDay(dayOffset);
    setWoName('');
    setShowModal(true);
  };

  const startDate = new Date(mesocycle.start_date + 'T00:00:00');

  const dayName = (offset: number): string => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + offset);
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  };

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
        Started {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} &middot; {mesocycle.microcycle_length}-day mesocycle
      </p>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      <div className="row g-3 mb-4">
        {Array.from({ length: mesocycle.microcycle_length }, (_, i) => {
          const dayWorkouts = workouts.filter((w) => w.day_offset === i);
          return (
            <div className="col-6 col-sm-4 col-md-3 col-lg-2" key={i}>
              <div className="day-cell">
              <div className="day-label">
                <span>{dayName(i)}</span>
                <span>Day {i + 1}</span>
              </div>
              {dayWorkouts.map((w) => (
                <div key={w.id} style={{ position: 'relative' }}>
                  <Link to={`/programs/${program!.id}/workouts/${w.id}`} className="workout-chip">
                    {w.name}
                    <button
                      className="btn btn-xs btn-danger"
                      style={{ float: 'right', marginTop: -1 }}
                      onClick={(e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); handleDelete(w.id); }}
                    >&times;</button>
                  </Link>
                </div>
              ))}
              <button className="add-chip" onClick={() => openAdd(i)}>+ Add workout</button>
              </div>
            </div>
          );
        })}
      </div>

      <FormModal show={showModal} onHide={() => setShowModal(false)} title="Add Workout" onSubmit={handleAdd} submitLabel="Add">
        <div className="form-group">
          <label>Workout Name</label>
          <input
            value={woName} onChange={(e) => setWoName(e.target.value)}
            placeholder={`e.g. ${dayName(addDay)} Workout`}
            required autoFocus
          />
        </div>
      </FormModal>

      <ConfirmModal
        show={showDeleteConfirm}
        onHide={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Workout"
        message={`Delete "${pendingDelete?.name}"?`}
      />
    </>
  );
}
