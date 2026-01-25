import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Container, Row, Col, Card, Form, Button, Table, Badge, Alert 
} from 'react-bootstrap';
import {
  daysApi,
  workoutGroupsApi,
  dayWorkoutGroupsApi,
  exercisesApi,
  dayExercisesApi,
  setsApi
} from '../../api/workoutApi';
import '../css/DayWorkout.css';

function DayWorkout() {
  const { dayId } = useParams();
  const navigate = useNavigate();
  
  const [day, setDay] = useState(null);
  const [allWorkoutGroups, setAllWorkoutGroups] = useState([]);
  const [selectedWorkoutGroups, setSelectedWorkoutGroups] = useState([]);
  const [allExercises, setAllExercises] = useState([]);
  const [dayExercises, setDayExercises] = useState([]);
  const [alert, setAlert] = useState(null);
  
  // Form state for adding exercise
  const [showExerciseAdd, setShowExerciseAdd] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState('');

  useEffect(() => {
    loadData();
  }, [dayId]);

  const loadData = async () => {
    const dayResponse = await daysApi.getById(parseInt(dayId));
    const groupsResponse = await workoutGroupsApi.getAll();
    const dayGroupsResponse = await dayWorkoutGroupsApi.getByDay(parseInt(dayId));
    const exercisesResponse = await exercisesApi.getAll();
    const dayExercisesResponse = await dayExercisesApi.getByDay(parseInt(dayId));
    
    if (dayResponse.success) {
      setDay(dayResponse.data);
    } else {
      showAlert(dayResponse.error, 'danger');
    }
    
    if (groupsResponse.success) {
      setAllWorkoutGroups(groupsResponse.data);
    } else {
      showAlert(groupsResponse.error, 'danger');
    }
    
    if (dayGroupsResponse.success) {
      const groupIds = dayGroupsResponse.data.map(g => g.workout_group_id);
      setSelectedWorkoutGroups(groupIds);
    } else {
      showAlert(dayGroupsResponse.error, 'danger');
    }
    
    if (exercisesResponse.success) {
      setAllExercises(exercisesResponse.data);
    } else {
      showAlert(exercisesResponse.error, 'danger');
    }
    
    if (dayExercisesResponse.success) {
      // Get sets for this day to merge with day exercises
      const setsResponse = await setsApi.getByDay(parseInt(dayId));
      const sets = setsResponse.success ? setsResponse.data : [];
      
      // Build the day exercises array with sets grouped by day_exercise_id
      const exercisesWithSets = dayExercisesResponse.data.map(dayEx => {
        const exerciseSets = sets
          .filter(set => set.day_exercise_id === dayEx.id)
          .sort((a, b) => a.set_order - b.set_order)
          .map(set => ({
            id: set.id,
            set_order: set.set_order,
            reps: set.reps,
            rir: set.rir,
            notes: set.notes || ''
          }));
        
        return {
          dayExerciseId: dayEx.id,
          exerciseId: dayEx.exercise_id,
          exerciseName: dayEx.exercise_name,
          workoutGroupName: dayEx.workout_group_name,
          exerciseNotes: dayEx.exercise_notes || '',
          exerciseOrder: dayEx.exercise_order,
          sets: exerciseSets
        };
      });
      
      setDayExercises(exercisesWithSets);
    } else {
      showAlert(dayExercisesResponse.error, 'danger');
    }
  };

  const showAlert = (message, variant = 'success') => {
    setAlert({ message, variant });
  };

  const handleWorkoutGroupToggle = async (groupId) => {
    const newSelection = selectedWorkoutGroups.includes(groupId)
      ? selectedWorkoutGroups.filter(id => id !== groupId)
      : [...selectedWorkoutGroups, groupId];
    
    const response = await dayWorkoutGroupsApi.setForDay(parseInt(dayId), newSelection);
    
    if (response.success) {
      setSelectedWorkoutGroups(newSelection);
      showAlert('Workout groups updated');
    } else {
      showAlert(response.error, 'danger');
    }
  };

  const handleAddExerciseClick = () => {
    setShowExerciseAdd(true);
    setSelectedExercise('');
  };

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

  const handleAddExercise = async (e) => {
    e.preventDefault();
    
    if (!selectedExercise) {
      showAlert('Please select an exercise', 'warning');
      return;
    }
    
    const response = await dayExercisesApi.create({
      dayId: parseInt(dayId),
      exerciseId: parseInt(selectedExercise)
    });
    
    if (response.success) {
      setShowExerciseAdd(false);
      setSelectedExercise('');
      loadData();
      showAlert(response.message);
    } else {
      showAlert(response.error, 'danger');
    }
  };

  const handleDeleteExercise = async (dayExerciseId, exerciseName) => {
    if (window.confirm(`Remove "${exerciseName}" and all its sets from this day?`)) {
      const response = await dayExercisesApi.delete(dayExerciseId);
      
      if (response.success) {
        loadData();
        showAlert('Exercise removed successfully');
      } else {
        showAlert(response.error, 'danger');
      }
    }
  };

  const handleAddSet = async (dayExerciseId) => {
    const response = await setsApi.create({
      dayExerciseId: dayExerciseId,
      reps: null,
      rir: null,
      notes: ''
    });
    
    if (response.success) {
      loadData();
      showAlert('Set added');
    } else {
      showAlert(response.error, 'danger');
    }
  };

  const handleUpdateSet = async (setId, field, value) => {
    const set = dayExercises
      .flatMap(ex => ex.sets)
      .find(s => s.id === setId);
    
    if (!set) return;
    
    const updates = {
      setOrder: set.set_order,
      reps: set.reps,
      rir: set.rir,
      notes: set.notes || '',
      [field]: value
    };
    
    const response = await setsApi.update(setId, updates);
    
    if (response.success) {
      loadData();
    } else {
      showAlert(response.error, 'danger');
    }
  };

  const handleDeleteSet = async (setId) => {
    if (window.confirm('Delete this set?')) {
      const response = await setsApi.delete(setId);
      
      if (response.success) {
        loadData();
        showAlert('Set deleted');
      } else {
        showAlert(response.error, 'danger');
      }
    }
  };

  if (!day) {
    return (
      <Container className="text-center mt-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </Container>
    );
  };

  return (
    <Container className="day-workout-page py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>{day.day_name} Workout</h1>
        <Button variant="outline-secondary" onClick={() => navigate('/')}>
          ← Back to Week
        </Button>
      </div>

      {alert && (
        <Alert variant={alert.variant} dismissible onClose={() => setAlert(null)}>
          {alert.message}
        </Alert>
      )}

      {/* Workout Groups Selection */}
      <Row className="mb-4">
        <Col>
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
                    onChange={() => handleWorkoutGroupToggle(group.id)}
                    className="workout-group-checkbox"
                  />
                ))}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Exercise List */}
      <Row>
        <Col>
          <Card>
            <Card.Header className="bg-primary text-white d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Exercises & Sets</h5>
              {!showExerciseAdd && (
                <Button 
                  size="sm" 
                  variant="light"
                  onClick={handleAddExerciseClick}
                >
                  + Add Exercise
                </Button>
              )}
            </Card.Header>
            <Card.Body>
              {/* Inline Add Exercise Form */}
              {showExerciseAdd && (
                <Card className="mb-3 border-success">
                  <Card.Body className="bg-light">
                    <Form onSubmit={handleAddExercise}>
                      <Row className="align-items-end">
                        <Col md={8}>
                          <Form.Group>
                            <Form.Label><strong>Select Exercise to Add</strong></Form.Label>
                            <Form.Select
                              value={selectedExercise}
                              onChange={(e) => setSelectedExercise(e.target.value)}
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
                              onClick={() => setShowExerciseAdd(false)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </Col>
                      </Row>
                    </Form>
                  </Card.Body>
                </Card>
              )}

              {/* Exercise List */}
              {dayExercises.length === 0 ? (
                <p className="text-muted mb-0 text-center py-4">
                  No exercises added yet. Click "Add Exercise" to get started.
                </p>
              ) : (
                dayExercises.map((dayEx, index) => (
                  <Card key={dayEx.dayExerciseId} className="mb-3">
                    <Card.Header className="d-flex justify-content-between align-items-center">
                      <div>
                        <Badge bg="secondary" className="me-2">
                          #{index + 1}
                        </Badge>
                        <strong>{dayEx.exerciseName}</strong>
                        <Badge bg="info" className="ms-2">
                          {dayEx.workoutGroupName}
                        </Badge>
                        {dayEx.exerciseNotes && (
                          <small className="text-muted ms-2">({dayEx.exerciseNotes})</small>
                        )}
                      </div>
                      <div className="d-flex gap-2">
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => handleAddSet(dayEx.dayExerciseId)}
                        >
                          + Add Set
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-danger"
                          onClick={() => handleDeleteExercise(dayEx.dayExerciseId, dayEx.exerciseName)}
                        >
                          Remove Exercise
                        </Button>
                      </div>
                    </Card.Header>
                    <Card.Body className="p-0">
                      {dayEx.sets.length === 0 ? (
                        <div className="text-center text-muted py-3">
                          No sets yet. Click "Add Set" above.
                        </div>
                      ) : (
                        <Table striped bordered hover responsive className="mb-0">
                          <thead>
                            <tr>
                              <th width="10%">Set</th>
                              <th width="20%">Reps</th>
                              <th width="20%">RIR</th>
                              <th width="35%">Notes</th>
                              <th width="15%">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dayEx.sets.map(set => (
                              <tr key={set.id}>
                                <td className="align-middle text-center">
                                  <strong>{set.set_order}</strong>
                                </td>
                                <td>
                                  <Form.Control
                                    type="number"
                                    value={set.reps || ''}
                                    onChange={(e) => handleUpdateSet(set.id, 'reps', e.target.value ? parseInt(e.target.value) : null)}
                                    size="sm"
                                    min="1"
                                    placeholder="8"
                                  />
                                </td>
                                <td>
                                  <Form.Control
                                    type="number"
                                    value={set.rir || ''}
                                    onChange={(e) => handleUpdateSet(set.id, 'rir', e.target.value ? parseInt(e.target.value) : null)}
                                    size="sm"
                                    min="0"
                                    placeholder="2"
                                  />
                                </td>
                                <td>
                                  <Form.Control
                                    type="text"
                                    value={set.notes || ''}
                                    onChange={(e) => handleUpdateSet(set.id, 'notes', e.target.value)}
                                    size="sm"
                                    placeholder="Optional notes"
                                  />
                                </td>
                                <td className="text-center">
                                  <Button
                                    size="sm"
                                    variant="outline-danger"
                                    onClick={() => handleDeleteSet(set.id)}
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
                ))
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default DayWorkout;
