

import { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Form, Table, Alert, Badge, Spinner } from 'react-bootstrap';
import { createDatabase, deleteDatabase, saveDatabase, loadDatabase } from '../db/databaseSetupService.js';
import { mesocyclesApi } from '../db/databaseAPI.js';

const SCHEMA_VERSION = 1;
const TODAY = new Date().toISOString().split('T')[0];

function OverviewPage() {
  const [dbReady, setDbReady] = useState(false);
  const [dbStatus, setDbStatus] = useState(null); // { type: 'success'|'danger', message }
  const [dbLoading, setDbLoading] = useState(false);

  const [mesocycles, setMesocycles] = useState([]);
  const [listError, setListError] = useState(null);

  const [form, setForm] = useState({ program_name: '', start_date: TODAY, microcycle_length: 4, notes: '' });
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const loadMesocycles = useCallback(() => {
    const response = mesocyclesApi.list();
    if (response.success) {
      setMesocycles(response.data);
      setListError(null);
    } else {
      setListError(response.error);
    }
  }, []);

  useEffect(() => {
    if (dbReady) loadMesocycles();
  }, [dbReady, loadMesocycles]);

  // --- DB Controls ---

  const handleCreateDb = async () => {
    setDbLoading(true);
    setDbStatus(null);
    try {
      await createDatabase(SCHEMA_VERSION);
      setDbReady(true);
      setDbStatus({ type: 'success', message: `Database v${SCHEMA_VERSION} created in memory.` });
    } catch (e) {
      setDbStatus({ type: 'danger', message: e.message });
    } finally {
      setDbLoading(false);
    }
  };

  const handleSaveDb = async () => {
    setDbLoading(true);
    setDbStatus(null);
    try {
      await saveDatabase(SCHEMA_VERSION);
      setDbStatus({ type: 'success', message: `Database v${SCHEMA_VERSION} saved to IndexedDB.` });
    } catch (e) {
      setDbStatus({ type: 'danger', message: e.message });
    } finally {
      setDbLoading(false);
    }
  };

  const handleLoadDb = async () => {
    setDbLoading(true);
    setDbStatus(null);
    try {
      await loadDatabase(SCHEMA_VERSION);
      setDbReady(true);
      loadMesocycles();
      setDbStatus({ type: 'success', message: `Database v${SCHEMA_VERSION} loaded from IndexedDB.` });
    } catch (e) {
      setDbStatus({ type: 'danger', message: e.message });
    } finally {
      setDbLoading(false);
    }
  };

  const handleDeleteDb = () => {
    if (!window.confirm('Drop all tables from the in-memory database? This cannot be undone.')) return;
    setDbStatus(null);
    try {
      deleteDatabase(SCHEMA_VERSION);
      setDbReady(false);
      setMesocycles([]);
      setDbStatus({ type: 'success', message: `Database v${SCHEMA_VERSION} tables dropped.` });
    } catch (e) {
      setDbStatus({ type: 'danger', message: e.message });
    }
  };

  // --- Mesocycle CRUD ---

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setFormSubmitting(true);
    const response = mesocyclesApi.create({
      ...form,
      microcycle_length: Number(form.microcycle_length)
    });
    if (response.success) {
      setFormSuccess(response.message);
      setForm({ program_name: '', start_date: TODAY, microcycle_length: 4, notes: '' });
      loadMesocycles();
    } else {
      setFormError(response.error);
    }
    setFormSubmitting(false);
  };

  const handleDelete = (id, name) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const response = mesocyclesApi.delete(id);
    if (response.success) {
      loadMesocycles();
    } else {
      setListError(response.error);
    }
  };

  return (
    <Container className="py-4">
      <h2 className="mb-4">Overview <Badge bg="secondary" style={{ fontSize: '0.6em', verticalAlign: 'middle' }}>Dev Test UI</Badge></h2>

      {/* ── DB Controls ─────────────────────────────────────────── */}
      <Card className="mb-4">
        <Card.Header>
          <strong>Database Controls</strong>{' '}
          <Badge bg={dbReady ? 'success' : 'warning'} text={dbReady ? 'white' : 'dark'}>
            {dbReady ? 'Ready' : 'Not initialised'}
          </Badge>
          {' '}
          <small className="text-muted">Schema v{SCHEMA_VERSION}</small>
        </Card.Header>
        <Card.Body>
          <div className="d-flex gap-2 flex-wrap">
            <Button variant="primary" onClick={handleCreateDb} disabled={dbLoading}>
              {dbLoading ? <Spinner size="sm" /> : 'Create Database'}
            </Button>
            <Button variant="outline-secondary" onClick={handleSaveDb} disabled={dbLoading || !dbReady}>
              Save to IndexedDB
            </Button>
            <Button variant="outline-secondary" onClick={handleLoadDb} disabled={dbLoading}>
              Load from IndexedDB
            </Button>
            <Button variant="outline-danger" onClick={handleDeleteDb} disabled={dbLoading || !dbReady}>
              Delete Database
            </Button>
          </div>
          {dbStatus && (
            <Alert variant={dbStatus.type} className="mt-3 mb-0 py-2">
              {dbStatus.message}
            </Alert>
          )}
        </Card.Body>
      </Card>

      <Row>
        {/* ── Create Mesocycle ─────────────────────────────────── */}
        <Col md={4}>
          <Card className="mb-4">
            <Card.Header><strong>Create Mesocycle</strong></Card.Header>
            <Card.Body>
              {!dbReady && (
                <Alert variant="warning" className="py-2">Initialise the database first.</Alert>
              )}
              <Form onSubmit={handleCreate}>
                <Form.Group className="mb-3">
                  <Form.Label>Program Name</Form.Label>
                  <Form.Control
                    name="program_name"
                    value={form.program_name}
                    onChange={handleFormChange}
                    placeholder="e.g. Hypertrophy Block 1"
                    disabled={!dbReady}
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Start Date</Form.Label>
                  <Form.Control
                    type="date"
                    name="start_date"
                    value={form.start_date}
                    onChange={handleFormChange}
                    disabled={!dbReady}
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Microcycle Length (weeks)</Form.Label>
                  <Form.Control
                    type="number"
                    name="microcycle_length"
                    value={form.microcycle_length}
                    onChange={handleFormChange}
                    min={1}
                    max={52}
                    disabled={!dbReady}
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Notes <span className="text-muted">(optional)</span></Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    name="notes"
                    value={form.notes}
                    onChange={handleFormChange}
                    disabled={!dbReady}
                  />
                </Form.Group>
                {formError && <Alert variant="danger" className="py-2">{formError}</Alert>}
                {formSuccess && <Alert variant="success" className="py-2">{formSuccess}</Alert>}
                <Button type="submit" variant="success" disabled={!dbReady || formSubmitting}>
                  {formSubmitting ? <Spinner size="sm" /> : 'Add Mesocycle'}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* ── Mesocycles List ──────────────────────────────────── */}
        <Col md={8}>
          <Card className="mb-4">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <strong>Mesocycles</strong>
              <Button size="sm" variant="outline-primary" onClick={loadMesocycles} disabled={!dbReady}>
                Refresh
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              {listError && (
                <Alert variant="danger" className="m-3 py-2">{listError}</Alert>
              )}
              {!dbReady ? (
                <p className="text-muted p-3 mb-0">Initialise the database to view mesocycles.</p>
              ) : mesocycles.length === 0 ? (
                <p className="text-muted p-3 mb-0">No mesocycles yet.</p>
              ) : (
                <Table hover responsive className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Start Date</th>
                      <th>Weeks</th>
                      <th>Notes</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {mesocycles.map(m => (
                      <tr key={m.id}>
                        <td className="text-muted">{m.id}</td>
                        <td>{m.program_name}</td>
                        <td>{m.start_date}</td>
                        <td>{m.microcycle_length}</td>
                        <td><span className="text-muted">{m.notes || '—'}</span></td>
                        <td>
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => handleDelete(m.id, m.program_name)}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default OverviewPage;
 