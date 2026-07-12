import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Program } from '../types/domain';
import { programsApi } from '../api/programsApi';
import { FormModal, ConfirmModal } from '../components';

interface Alert {
  type: string;
  msg: string;
}

interface PendingDelete {
  id: number;
  name: string;
}

export default function HomePage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', notes: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setPrograms(programsApi.list());
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (type: string, msg: string) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 4000);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({ name: '', notes: '' });
    setShowModal(true);
  };

  const openEdit = (p: Program) => {
    setEditingId(p.id);
    setForm({ name: p.name, notes: p.notes || '' });
    setShowModal(true);
  };

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await programsApi.update(editingId, form);
        flash('success', `"${form.name}" updated.`);
      } else {
        await programsApi.create(form);
        flash('success', `"${form.name}" created.`);
      }
      setShowModal(false);
      load();
    } catch (err) {
      flash('danger', `Failed: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: number) => {
    const p = programs.find((x) => x.id === id);
    if (!p) return;
    setPendingDelete({ id, name: p.name });
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setSaving(true);
    try {
      await programsApi.delete(pendingDelete.id);
      flash('success', `"${pendingDelete.name}" deleted.`);
      setShowDeleteConfirm(false);
      load();
    } catch (err) {
      flash('danger', `Delete failed: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
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
          <button className="btn btn-primary" onClick={openAdd} disabled={saving}>+ New Program</button>
          <p style={{ marginTop: 12, fontSize: 13 }}>
            Not sure where to start? <Link to="/tutorial">Check out the tutorial</Link>
          </p>
        </div>
      ) : (
        <div className="row g-3">
          {programs.map((p) => (
            <div className="col-12 col-sm-6 col-lg-4" key={p.id}>
              <div className="card">
              <h3 style={{ marginBottom: 6 }}>{p.name}</h3>
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
