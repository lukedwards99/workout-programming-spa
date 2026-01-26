import React from 'react';
import { Table, Form, Button } from 'react-bootstrap';

function ExerciseSetTable({ sets, onUpdateSet, onDeleteSet, onAddSet, dayExerciseId }) {
  if (sets.length === 0) {
    return (
      <div className="text-center text-muted py-3">
        No sets yet. Click "Add Set" above.
      </div>
    );
  }

  return (
    <Table striped bordered hover responsive className="mb-0">
      <thead>
        <tr>
          <th width="8%">Set</th>
          <th width="15%">Reps</th>
          <th width="15%">Weight</th>
          <th width="15%">RIR</th>
          <th width="32%">Notes</th>
          <th width="15%">Actions</th>
        </tr>
      </thead>
      <tbody>
        {sets.map(set => (
          <tr key={set.id}>
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
            <td>
              <Form.Control
                type="text"
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
        ))}
      </tbody>
    </Table>
  );
}

export default ExerciseSetTable;
