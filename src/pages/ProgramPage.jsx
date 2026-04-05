import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Table, Button, Form, Alert } from 'react-bootstrap';
import { programsApi, mesocyclesApi } from '../db/databaseAPI.js';

const TODAY = new Date().toISOString().split('T')[0];
const EMPTY_FORM = { program_name: '', start_date: TODAY, microcycle_length: 7, notes: '' };

function ProgramPage() {
  const { programId } = useParams();
  const navigate = useNavigate();
  const id = Number(programId);

  const [program, setProgram] = useState(null);
  const [mesocycles, setMesocycles] = useState([]);
  const [alert, setAlert] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  const loadProgram = useCallback(() => {
    const res = programsApi.get(id);
    if (res.success) setProgram(res.data);
    else showAlert('danger', res.error);
  }, [id]);

  const loadMesocycles = useCallback(() => {
    const res = programsApi.listMesocycles(id);
    if (res.success) setMesocycles(res.data);
    else showAlert('danger', res.error);
  }, [id]);

  useEffect(() => {
    loadProgram();
    loadMesocycles();
  }, [loadProgram, loadMesocycles]);

  const handleCreate = (e) => {
    e.preventDefault();
    const res = mesocyclesApi.create({ ...form, program_id: id });
    if (res.success) {
      showAlert('success', res.message);
      setForm(EMPTY_FORM);
      loadMesocycles();
    } else {
      showAlert('danger', res.error);
    }
  };

  const handleStartEdit = (m) => {
    setEditingId(m.id);
    setEditForm({
      program_name: m.program_name,
      start_date: m.start_date,
      microcycle_length: m.microcycle_length,
      notes: m.notes ?? '',
    });
  };

  const handleSaveEdit = (mesocycleId) => {
    const res = mesocyclesApi.update(mesocycleId, { ...editForm, program_id: id });
    if (res.success) {
      showAlert('success', res.message);
      setEditingId(null);
      loadMesocycles();
    } else {
      showAlert('danger', res.error);
    }
  };

  const handleDelete = (mesocycleId) => {
    if (!window.confirm('Delete this mesocycle?')) return;
    const res = mesocyclesApi.delete(mesocycleId);
    if (res.success) {
      showAlert('success', res.message);
      loadMesocycles();
    } else {
      showAlert('danger', res.error);
    }
  };

  return (
    <Container className="py-4">
      <Button variant="link" className="ps-0 mb-2" onClick={() => navigate('/')}>
        ← Back to Programs
      </Button>

      <h2 className="mb-1">{program?.name ?? '...'}</h2>
      {program?.notes && <p className="text-muted mb-4">{program.notes}</p>}

      <h5 className="mt-4 mb-3">Mesocycles</h5>

      {alert && (
        <Alert variant={alert.type} dismissible onClose={() => setAlert(null)}>
          {alert.message}
        </Alert>
      )}

      <Form onSubmit={handleCreate} className="d-flex gap-2 align-items-end flex-wrap mb-4">
        <Form.Group>
          <Form.Label>Name</Form.Label>
          <Form.Control
            value={form.program_name}
            onChange={e => setForm(f => ({ ...f, program_name: e.target.value }))}
            placeholder="Mesocycle name"
            required
          />
        </Form.Group>
        <Form.Group>
          <Form.Label>Start Date</Form.Label>
          <Form.Control
            type="date"
            value={form.start_date}
            onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
            required
          />
        </Form.Group>
        <Form.Group style={{ width: 140 }}>
          <Form.Label>Microcycle Length (days)</Form.Label>
          <Form.Control
            type="number"
            min={1}
            value={form.microcycle_length}
            onChange={e => setForm(f => ({ ...f, microcycle_length: Number(e.target.value) }))}
            required
          />
        </Form.Group>
        <Form.Group>
          <Form.Label>Notes</Form.Label>
          <Form.Control
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Optional"
          />
        </Form.Group>
        <Button type="submit" variant="primary">Add Mesocycle</Button>
      </Form>

      <Table bordered hover>
        <thead>
          <tr>
            <th>Name</th>
            <th>Start Date</th>
            <th>Microcycle Length</th>
            <th>Notes</th>
            <th style={{ width: 160 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {mesocycles.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-muted">No mesocycles yet.</td>
            </tr>
          )}
          {mesocycles.map(m =>
            editingId === m.id ? (
              <tr key={m.id}>
                <td>
                  <Form.Control
                    value={editForm.program_name}
                    onChange={e => setEditForm(f => ({ ...f, program_name: e.target.value }))}
                  />
                </td>
                <td>
                  <Form.Control
                    type="date"
                    value={editForm.start_date}
                    onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))}
                  />
                </td>
                <td>
                  <Form.Control
                    type="number"
                    min={1}
                    value={editForm.microcycle_length}
                    onChange={e => setEditForm(f => ({ ...f, microcycle_length: Number(e.target.value) }))}
                  />
                </td>
                <td>
                  <Form.Control
                    value={editForm.notes}
                    onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  />
                </td>
                <td>
                  <Button size="sm" variant="success" onClick={() => handleSaveEdit(m.id)} className="me-1">Save</Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                </td>
              </tr>
            ) : (
              <tr key={m.id}>
                <td>{m.program_name}</td>
                <td>{m.start_date}</td>
                <td>{m.microcycle_length}</td>
                <td>{m.notes ?? <span className="text-muted">—</span>}</td>
                <td>
                  <Button size="sm" variant="outline-secondary" onClick={() => handleStartEdit(m)} className="me-1">Edit</Button>
                  <Button size="sm" variant="outline-danger" onClick={() => handleDelete(m.id)}>Delete</Button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </Table>
    </Container>
  );
}

export default ProgramPage;
