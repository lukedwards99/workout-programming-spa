import React from 'react';
import { Card, Form, Button, Row, Col } from 'react-bootstrap';

function ExerciseAddForm({ 
  allExercises, 
  selectedWorkoutGroups, 
  selectedExercise, 
  onExerciseChange,
  onSubmit,
  onCancel
}) {
  // Organize exercises: selected workout groups first, then others
  const organizedExercises = () => {
    const priorityExercises = allExercises.filter(ex => 
      selectedWorkoutGroups.includes(ex.workout_group_id)
    );
    const otherExercises = allExercises.filter(ex => 
      !selectedWorkoutGroups.includes(ex.workout_group_id)
    );
    return [...priorityExercises, ...otherExercises];
  };

  return (
    <Card className="mb-3 border-success">
      <Card.Body className="bg-light">
        <Form onSubmit={onSubmit}>
          <Row className="align-items-end">
            <Col md={8}>
              <Form.Group>
                <Form.Label><strong>Select Exercise to Add</strong></Form.Label>
                <Form.Select
                  value={selectedExercise}
                  onChange={(e) => onExerciseChange(e.target.value)}
                  required
                >
                  <option value="">Choose an exercise...</option>
                  {selectedWorkoutGroups.length > 0 && (
                    <optgroup label="─── Priority (Selected Muscle Groups) ───">
                      {organizedExercises()
                        .filter(ex => selectedWorkoutGroups.includes(ex.workout_group_id))
                        .map(ex => (
                          <option key={ex.id} value={ex.id}>
                            {ex.name} ({ex.workout_group_name})
                          </option>
                        ))}
                    </optgroup>
                  )}
                  <optgroup label={selectedWorkoutGroups.length > 0 ? "─── Other Exercises ───" : "─── All Exercises ───"}>
                    {organizedExercises()
                      .filter(ex => !selectedWorkoutGroups.includes(ex.workout_group_id))
                      .map(ex => (
                        <option key={ex.id} value={ex.id}>
                          {ex.name} ({ex.workout_group_name})
                        </option>
                      ))}
                  </optgroup>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <div className="d-flex gap-2">
                <Button type="submit" variant="success">
                  Add
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={onCancel}
                >
                  Cancel
                </Button>
              </div>
            </Col>
          </Row>
        </Form>
      </Card.Body>
    </Card>
  );
}

export default ExerciseAddForm;
