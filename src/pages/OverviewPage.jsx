import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Table, Button, Form, Alert } from 'react-bootstrap';
import { programsApi } from '../db/databaseAPI.js';

const EMPTY_FORM = { name: '', notes: '' };

function OverviewPage() {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState([]);
  const [alert, setAlert] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const loadPrograms = useCallback(() => {
    const res = programsApi.list();
    if (res.success) setPrograms(res.data);
    else showAlert('danger', res.error);
  }, []);

  useEffect(() => { loadPrograms(); }, [loadPrograms]);

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleCreate = (e) => {
    e.preventDefault();
    const res = programsApi.create(form);
    if (res.success) {
      showAlert('success', res.message);
      setForm(EMPTY_FORM);
      loadPrograms();
    } else {
      showAlert('danger', res.error);
    }
  };

  const handleStartEdit = (program) => {
    setEditingId(program.id);
    setEditForm({ name: program.name, notes: program.notes ?? '' });
  };

  const handleSaveEdit = (id) => {
    const res = programsApi.update(id, editForm);
    if (res.success) {
      showAlert('success', res.message);
      setEditingId(null);
      loadPrograms();
    } else {
      showAlert('danger', res.error);
    }
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this program? All mesocycles within it will also be deleted.')) return;
    const res = programsApi.delete(id);
    if (res.success) {
      showAlert('success', res.message);
      loadPrograms();
    } else {
      showAlert('danger', res.error);
    }
  };

  return (
    <Container className="py-4">
      <h2 className="mb-4">Programs</h2>

      {alert && (
        <Alert variant={alert.type} dismissible onClose={() => setAlert(null)}>
          {alert.message}
        </Alert>
      )}

      <Form onSubmit={handleCreate} className="d-flex gap-2 align-items-end flex-wrap mb-4">
        <Form.Group>
          <Form.Label>Name</Form.Label>
          <Form.Control
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Program name"
            required
          />
        </Form.Group>
        <Form.Group>
          <Form.Label>Notes</Form.Label>
          <Form.Control
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Optional notes"
          />
        </Form.Group>
        <Button type="submit" variant="primary">Add Program</Button>
      </Form>

      <Table bordered hover>
        <thead>
          <tr>
            <th>Name</th>
            <th>Notes</th>
            <th style={{ width: 230 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {programs.length === 0 && (
            <tr>
              <td colSpan={3} className="text-center text-muted">No programs yet.</td>
            </tr>
          )}
          {programs.map(program =>
            editingId === program.id ? (
              <tr key={program.id}>
                <td>
                  <Form.Control
                    value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  />
                </td>
                <td>
                  <Form.Control
                    value={editForm.notes}
                    onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  />
                </td>
                <td>
                  <Button size="sm" variant="success" onClick={() => handleSaveEdit(program.id)} className="me-1">Save</Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                </td>
              </tr>
            ) : (
              <tr key={program.id}>
                <td>{program.name}</td>
                <td>{program.notes ?? <span className="text-muted">—</span>}</td>
                <td>
                  <Button size="sm" variant="outline-primary" onClick={() => navigate(`/programs/${program.id}`)} className="me-1">View</Button>
                  <Button size="sm" variant="outline-secondary" onClick={() => handleStartEdit(program)} className="me-1">Edit</Button>
                  <Button size="sm" variant="outline-danger" onClick={() => handleDelete(program.id)}>Delete</Button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </Table>
    </Container>
  );
}

export default OverviewPage;
