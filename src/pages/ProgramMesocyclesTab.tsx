import { useState, useEffect, useCallback, type FormEvent, type MouseEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Program, MesocycleWithWorkoutCount } from '../types/domain';
import { programsApi } from '../api/programsApi';
import { mesocyclesApi } from '../api/mesocyclesApi';
import { FormModal, ConfirmModal } from '../components';

interface Alert {
  type: string;
  msg: string;
}

interface PendingDelete {
  id: number;
  name: string;
}

interface MesoForm {
  name: string;
  mesocycleLength: number;
  startDate: string;
  notes: string;
}

export default function ProgramMesocyclesTab() {
  const { programId } = useParams<{ programId: string }>();
  const navigate = useNavigate();
  const [program, setProgram] = useState<Program | null>(null);
  const [mesocycles, setMesocycles] = useState<MesocycleWithWorkoutCount[]>([]);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [form, setForm] = useState<MesoForm>({ name: '', mesocycleLength: 7, startDate: today(), notes: '' });
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<MesoForm>({ name: '', mesocycleLength: 7, startDate: '', notes: '' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  function today(): string { return new Date().toISOString().split('T')[0]; }

  const load = useCallback(() => {
    const p = programsApi.get(Number(programId));
    if (p) {
      setProgram(p);
      setMesocycles(mesocyclesApi.list());
    }
  }, [programId]);

  useEffect(() => { load(); }, [load]);

  if (!program) return null;

  const flash = (type: string, msg: string) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleAdd = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    mesocyclesApi.create({
      name: form.name.trim(),
      mesocycleLength: form.mesocycleLength,
      startDate: form.startDate,
      notes: form.notes,
    });
    flash('success', `"${form.name}" added.`);
    setForm({ name: '', mesocycleLength: 7, startDate: today(), notes: '' });
    load();
  };

  const openEdit = (m: MesocycleWithWorkoutCount) => {
    setEditId(m.id);
    setEditForm({ name: m.name, mesocycleLength: m.mesocycle_length, startDate: m.start_date, notes: m.notes || '' });
    setShowEditModal(true);
  };

  const handleEdit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (editId === null) return;
    mesocyclesApi.update(editId, {
      name: editForm.name.trim(),
      mesocycleLength: editForm.mesocycleLength,
      startDate: editForm.startDate,
      notes: editForm.notes,
    });
    flash('success', `"${editForm.name}" updated.`);
    setShowEditModal(false);
    load();
  };

  const handleDelete = (id: number) => {
    const m = mesocycles.find((x) => x.id === id);
    if (!m) return;
    setPendingDelete({ id, name: m.name });
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    mesocyclesApi.delete(pendingDelete.id);
    flash('success', `"${pendingDelete.name}" deleted.`);
    load();
  };

  return (
    <>
      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      <form className="add-row" onSubmit={handleAdd}>
        <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
          <label>Mesocycle Name</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. 4-Week Strength Block" />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Length (days)</label>
          <input type="number" value={form.mesocycleLength} onChange={(e) => setForm({ ...form, mesocycleLength: Number(e.target.value) })} min={1} max={120} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Start Date</label>
          <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        </div>
        <button type="submit" className="btn btn-primary">+ Add Mesocycle</button>
      </form>

      {mesocycles.length === 0 ? (
        <div className="empty-state"><p>No mesocycles yet. Create your first training block above.</p></div>
      ) : (
        <div className="table-responsive">
        <table className="responsive-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Length</th>
              <th>Start Date</th>
              <th>Workouts</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {mesocycles.map((m) => (
              <tr key={m.id} className="hoverable-row" onClick={() => navigate(`/programs/${program.id}/mesocycles/${m.id}`)} style={{ cursor: 'pointer' }}>
                <td data-label="Name"><strong>{m.name}</strong></td>
                <td data-label="Length">{m.mesocycle_length} days</td>
                <td data-label="Start Date">{new Date(m.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                <td data-label="Workouts"><span className="badge">{m.workout_count} workouts</span></td>
                <td data-label="Actions" className="row-actions">
                  <button className="btn btn-outline btn-sm" onClick={(e: MouseEvent) => { e.stopPropagation(); navigate(`/programs/${program.id}/mesocycles/${m.id}`); }}>View</button>
                  <button className="btn btn-outline btn-sm" onClick={(e: MouseEvent) => { e.stopPropagation(); openEdit(m); }}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={(e: MouseEvent) => { e.stopPropagation(); handleDelete(m.id); }}>Del</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      <FormModal show={showEditModal} onHide={() => setShowEditModal(false)} title="Edit Mesocycle" onSubmit={handleEdit}>
        <div className="form-group">
          <label>Name</label>
          <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required autoFocus />
        </div>
        <div className="form-group">
          <label>Mesocycle Length (days)</label>
          <input type="number" value={editForm.mesocycleLength} onChange={(e) => setEditForm({ ...editForm, mesocycleLength: Number(e.target.value) })} min={1} max={120} />
        </div>
        <div className="form-group">
          <label>Start Date</label>
          <input type="date" value={editForm.startDate} onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Notes</label>
          <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
        </div>
      </FormModal>

      <ConfirmModal
        show={showDeleteConfirm}
        onHide={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Mesocycle"
        message={`Delete "${pendingDelete?.name}"? All workouts inside will also be deleted.`}
      />
    </>
  );
}
