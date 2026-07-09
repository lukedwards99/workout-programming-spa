import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { programsApi } from '../api/programsApi';
import { FormModal, ConfirmModal } from '../components';

export default function HomePage() {
  const [programs, setPrograms] = useState([]);
  const [alert, setAlert] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', notes: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const load = useCallback(() => {
    setPrograms(programsApi.list());
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (type, msg) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 4000);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({ name: '', notes: '' });
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditingId(p.id);
    setForm({ name: p.name, notes: p.notes || '' });
    setShowModal(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (editingId) {
      programsApi.update(editingId, form);
      flash('success', `"${form.name}" updated.`);
    } else {
      programsApi.create(form);
      flash('success', `"${form.name}" created.`);
    }
    setShowModal(false);
    load();
  };

  const handleDelete = (id) => {
    const p = programs.find((x) => x.id === id);
    setPendingDelete({ id, name: p.name });
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    programsApi.delete(pendingDelete.id);
    flash('success', `"${pendingDelete.name}" deleted.`);
    load();
  };

  return (
    <>
      <div className="page-header">
        <h1>Programs</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ New Program</button>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      {programs.length === 0 ? (
        <div className="empty-state">
          <p>No programs yet. Create your first training program to get started.</p>
          <button className="btn btn-primary" onClick={openAdd}>+ New Program</button>
        </div>
      ) : (
        <div className="row g-3">
          {programs.map((p) => (
            <div className="col-12 col-sm-6 col-lg-4" key={p.id}>
              <div className="card">
              <h3 style={{ marginBottom: 6 }}>{p.name}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
                {p.meso_count} mesocycle{p.meso_count !== 1 ? 's' : ''}
              </p>
              {p.notes && (
                <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 14 }}>{p.notes}</p>
              )}
              {!p.notes && <p style={{ fontSize: 14, color: 'var(--text-muted)', opacity: 0.4, marginBottom: 14 }}>No notes</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <Link to={`/programs/${p.id}`} className="btn btn-outline btn-sm">View</Link>
                <button className="btn btn-outline btn-sm" onClick={() => openEdit(p)}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>Delete</button>
              </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <FormModal show={showModal} onHide={() => setShowModal(false)} title={editingId ? 'Edit Program' : 'New Program'} onSubmit={handleSave}>
        <div className="form-group">
          <label>Name</label>
          <input
            type="text" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Push/Pull/Legs 2025" required autoFocus
          />
        </div>
        <div className="form-group">
          <label>Notes (optional)</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Any notes about this program..."
          />
        </div>
      </FormModal>

      <ConfirmModal
        show={showDeleteConfirm}
        onHide={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Program"
        message={`Delete "${pendingDelete?.name}"? All mesocycles and workout data inside will also be deleted.`}
      />
    </>
  );
}
