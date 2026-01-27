import React, { useState } from 'react';
import { Table, Form, Button, Row, Col } from 'react-bootstrap';

function ExerciseSetTable({ sets, onUpdateSet, onDeleteSet, onAddSet, dayExerciseId }) {
  const [showMobileNotes, setShowMobileNotes] = useState(false);

  if (sets.length === 0) {
    return (
      <div className="text-center text-muted py-3">
        No sets yet. Click "Add Set" above.
      </div>
    );
  }

  return (
    <>
      <Table striped bordered hover responsive className="mb-0">
        <thead>
          <tr>
            <th width="8%">Set</th>
            <th width="15%">Reps</th>
            <th width="15%">Weight</th>
            <th width="15%">RIR</th>
            <th width="32%" className="d-none d-md-table-cell">Notes</th>
            <th width="15%">Actions</th>
          </tr>
        </thead>
      <tbody>
        {sets.map(set => (
          <React.Fragment key={set.id}>
            <tr>
              <td className="align-middle text-center">
                <strong>{set.set_order}</strong>
              </td>
              <td>
                <Form.Control
                  type="number"
                  value={set.reps || ''}
                  onChange={(e) => onUpdateSet(set.id, 'reps', e.target.value ? parseInt(e.target.value) : null)}
                  size="sm"
                  min="1"
                  placeholder="8"
                />
              </td>
              <td>
                <Form.Control
                  type="number"
                  value={set.weight || ''}
                  onChange={(e) => onUpdateSet(set.id, 'weight', e.target.value ? parseFloat(e.target.value) : null)}
                  size="sm"
                  min="0"
                  step="0.5"
                  placeholder="135"
                />
              </td>
              <td>
                <Form.Control
                  type="number"
                  value={set.rir || ''}
                  onChange={(e) => onUpdateSet(set.id, 'rir', e.target.value ? parseInt(e.target.value) : null)}
                  size="sm"
                  min="0"
                  placeholder="2"
                />
              </td>
              <td className="d-none d-md-table-cell">
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={set.notes || ''}
                  onChange={(e) => onUpdateSet(set.id, 'notes', e.target.value)}
                  size="sm"
                  placeholder="Optional notes"
                />
              </td>
              <td className="text-center">
                <Button
                  size="sm"
                  variant="outline-danger"
                  onClick={() => onDeleteSet(set.id)}
                >
                  Delete
                </Button>
              </td>
            </tr>
            {showMobileNotes && (
              <tr className="d-md-none">
                <td colSpan="5" className="py-2 px-3 bg-light">
                  <small className="text-muted d-block mb-1">Notes:</small>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={set.notes || ''}
                    onChange={(e) => onUpdateSet(set.id, 'notes', e.target.value)}
                    size="sm"
                    placeholder="Optional notes"
                  />
                </td>
              </tr>
            )}
          </React.Fragment>
        ))}
      </tbody>
    </Table>
      <div className="d-md-none mb-2 text-center pt-2">
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={() => setShowMobileNotes(!showMobileNotes)}
        >
          {showMobileNotes ? 'Hide' : 'Show'} Notes
        </Button>
      </div>
    </>
  );
}

export default ExerciseSetTable;
