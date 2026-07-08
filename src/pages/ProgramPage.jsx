import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { programsApi } from '../api/programsApi';
import { mesocyclesApi } from '../api/mesocyclesApi';

export default function ProgramPage() {
  const { programId } = useParams();
  const [program, setProgram] = useState(null);
  const [mesocycles, setMesocycles] = useState([]);
  const [alert, setAlert] = useState(null);
  const [form, setForm] = useState({ name: '', microcycleLength: 7, startDate: today(), notes: '' });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', microcycleLength: 7, startDate: '', notes: '' });
  const [showEditModal, setShowEditModal] = useState(false);

  function today() { return new Date().toISOString().split('T')[0]; }

  const load = useCallback(() => {
    const p = programsApi.get(Number(programId));
    if (p) {
      setProgram(p);
      setMesocycles(mesocyclesApi.list(p.id));
    }
  }, [programId]);

  useEffect(() => { load(); }, [load]);

  if (!program) return <div className="empty-state"><p>Program not found.</p></div>;

  const flash = (type, msg) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    mesocyclesApi.create({
      programId: program.id,
      name: form.name.trim(),
      microcycleLength: form.microcycleLength,
      startDate: form.startDate,
      notes: form.notes,
    });
    flash('success', `"${form.name}" added.`);
    setForm({ name: '', microcycleLength: 7, startDate: today(), notes: '' });
    load();
  };

  const openEdit = (m) => {
    setEditId(m.id);
    setEditForm({ name: m.name, microcycleLength: m.microcycle_length, startDate: m.start_date, notes: m.notes || '' });
    setShowEditModal(true);
  };

  const handleEdit = (e) => {
    e.preventDefault();
    mesocyclesApi.update(editId, {
      name: editForm.name.trim(),
      microcycleLength: editForm.microcycleLength,
      startDate: editForm.startDate,
      notes: editForm.notes,
    });
    flash('success', `"${editForm.name}" updated.`);
    setShowEditModal(false);
    load();
  };

  const handleDelete = (id) => {
    const m = mesocycles.find((x) => x.id === id);
    if (!window.confirm(`Delete "${m.name}"? All workouts inside will also be deleted.`)) return;
    mesocyclesApi.delete(id);
    flash('success', `"${m.name}" deleted.`);
    load();
  };

  return (
    <>
      <div className="breadcrumb">
        <Link to="/">Programs</Link><span>/</span><strong>{program.name}</strong>
      </div>

      <div className="page-header">
        <h1>{program.name}</h1>
      </div>
      {program.notes && <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>{program.notes}</p>}

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      {/* Add form */}
      <form className="add-row" onSubmit={handleAdd}>
        <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
          <label>Mesocycle Name</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. 4-Week Strength Block" />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Length (days)</label>
          <input type="number" value={form.microcycleLength} onChange={(e) => setForm({ ...form, microcycleLength: Number(e.target.value) })} min={1} max={14} style={{ width: 80 }} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Start Date</label>
          <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} style={{ width: 160 }} />
        </div>
        <button type="submit" className="btn btn-primary">+ Add Mesocycle</button>
      </form>

      {mesocycles.length === 0 ? (
        <div className="empty-state"><p>No mesocycles yet. Create your first training block above.</p></div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Length</th>
              <th>Start Date</th>
              <th>Workouts</th>
              <th style={{ width: 170 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {mesocycles.map((m) => (
              <tr key={m.id}>
                <td><strong>{m.name}</strong></td>
                <td>{m.microcycle_length} days</td>
                <td className="month-col">{new Date(m.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                <td><span className="badge">{m.workout_count} workouts</span></td>
                <td className="row-actions">
                  <Link to={`/mesocycles/${m.id}`} className="btn btn-outline btn-sm">View</Link>
                  <button className="btn btn-outline btn-sm" onClick={() => openEdit(m)}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m.id)}>Del</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Edit modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Mesocycle</h2>
            <form onSubmit={handleEdit}>
              <div className="form-group">
                <label>Name</label>
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required autoFocus />
              </div>
              <div className="form-group">
                <label>Microcycle Length</label>
                <input type="number" value={editForm.microcycleLength} onChange={(e) => setEditForm({ ...editForm, microcycleLength: Number(e.target.value) })} min={1} max={14} />
              </div>
              <div className="form-group">
                <label>Start Date</label>
                <input type="date" value={editForm.startDate} onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
