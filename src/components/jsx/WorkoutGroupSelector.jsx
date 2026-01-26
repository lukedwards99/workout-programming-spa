import React from 'react';
import { Card, Form } from 'react-bootstrap';

function WorkoutGroupSelector({ allWorkoutGroups, selectedWorkoutGroups, onToggle }) {
  return (
    <Card>
      <Card.Header className="bg-info text-white">
        <h5 className="mb-0">Muscle Groups for This Day</h5>
      </Card.Header>
      <Card.Body>
        <p className="text-muted mb-3">
          Select which muscle groups you'll work today. This helps prioritize exercises in the dropdown.
        </p>
        <div className="d-flex flex-wrap gap-2">
          {allWorkoutGroups.map(group => (
            <Form.Check
              key={group.id}
              type="checkbox"
              id={`group-${group.id}`}
              label={group.name}
              checked={selectedWorkoutGroups.includes(group.id)}
              onChange={() => onToggle(group.id)}
              className="workout-group-checkbox"
            />
          ))}
        </div>
      </Card.Body>
    </Card>
  );
}

export default WorkoutGroupSelector;
