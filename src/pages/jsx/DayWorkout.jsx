import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Container, Row, Col, Card, Form, Button, Table, Badge, Alert, ListGroup 
} from 'react-bootstrap';
import {
  getDayById,
  getAllWorkoutGroups,
  getDayWorkoutGroups,
  setDayWorkoutGroups,
  getExercisesByWorkoutGroups,
  getSetsByDay,
  createSet,
  updateSet,
  deleteSet
} from '../../db/dataService';
import '../css/DayWorkout.css';

function DayWorkout() {
  const { dayId } = useParams();
  const navigate = useNavigate();
  
  const [day, setDay] = useState(null);
  const [allWorkoutGroups, setAllWorkoutGroups] = useState([]);
  const [selectedWorkoutGroups, setSelectedWorkoutGroups] = useState([]);
  const [availableExercises, setAvailableExercises] = useState([]);
  const [workoutSets, setWorkoutSets] = useState({});
  const [alert, setAlert] = useState(null);
  
  // Form state for adding sets
  const [selectedExercise, setSelectedExercise] = useState('');
  const [newSetReps, setNewSetReps] = useState('');
  const [newSetRir, setNewSetRir] = useState('');
  const [newSetNotes, setNewSetNotes] = useState('');

  useEffect(() => {
    loadData();
  }, [dayId]);

  useEffect(() => {
    if (selectedWorkoutGroups.length > 0) {
      const exercises = getExercisesByWorkoutGroups(selectedWorkoutGroups);
      setAvailableExercises(exercises);
    } else {
      setAvailableExercises([]);
    }
  }, [selectedWorkoutGroups]);

  const loadData = () => {
    try {
      const dayData = getDayById(parseInt(dayId));
      setDay(dayData);
      
      const groups = getAllWorkoutGroups();
      setAllWorkoutGroups(groups);
      
      const dayGroups = getDayWorkoutGroups(parseInt(dayId));
      const groupIds = dayGroups.map(g => g.workout_group_id);
      setSelectedWorkoutGroups(groupIds);
      
      loadSets();
    } catch (error) {
      showAlert('Error loading data: ' + error.message, 'danger');
    }
  };

  const loadSets = () => {
    try {
      const sets = getSetsByDay(parseInt(dayId));
      
      // Group sets by exercise
      const groupedSets = {};
      sets.forEach(set => {
        if (!groupedSets[set.exercise_id]) {
          groupedSets[set.exercise_id] = {
            exerciseName: set.exercise_name,
            exerciseNotes: set.exercise_notes,
            workoutGroupName: set.workout_group_name,
            sets: []
          };
        }
        groupedSets[set.exercise_id].sets.push(set);
      });
      
      setWorkoutSets(groupedSets);
    } catch (error) {
      showAlert('Error loading sets: ' + error.message, 'danger');
    }
  };

  const showAlert = (message, variant = 'success') => {
    setAlert({ message, variant });
    // setTimeout(() => setAlert(null), 3000);
  };

  const handleWorkoutGroupToggle = async (groupId) => {
    const newSelection = selectedWorkoutGroups.includes(groupId)
      ? selectedWorkoutGroups.filter(id => id !== groupId)
      : [...selectedWorkoutGroups, groupId];
    
    try {
      await setDayWorkoutGroups(parseInt(dayId), newSelection);
      setSelectedWorkoutGroups(newSelection);
      showAlert('Workout groups updated');
    } catch (error) {
      showAlert('Error updating workout groups: ' + error.message, 'danger');
    }
  };

  const handleAddSet = async (e) => {
    e.preventDefault();
    
    if (!selectedExercise) {
      showAlert('Please select an exercise', 'warning');
      return;
    }
    
    try {
      await createSet(
        parseInt(dayId),
        parseInt(selectedExercise),
        newSetReps ? parseInt(newSetReps) : null,
        newSetRir ? parseInt(newSetRir) : null,
        newSetNotes
      );
      
      // Reset form
      setNewSetReps('');
      setNewSetRir('');
      setNewSetNotes('');
      
      loadSets();
      showAlert('Set added successfully');
    } catch (error) {
      showAlert('Error adding set: ' + error.message, 'danger');
    }
  };

  const handleUpdateSet = async (setId, field, value) => {
    try {
      const set = Object.values(workoutSets)
        .flatMap(ex => ex.sets)
        .find(s => s.id === setId);
      
      if (!set) return;
      
      const updates = {
        set_order: set.set_order,
        reps: set.reps,
        rir: set.rir,
        notes: set.notes || '',
        [field]: value
      };
      
      await updateSet(setId, updates.set_order, updates.reps, updates.rir, updates.notes);
      loadSets();
    } catch (error) {
      showAlert('Error updating set: ' + error.message, 'danger');
    }
  };

  const handleDeleteSet = async (setId) => {
    if (window.confirm('Delete this set?')) {
      try {
        await deleteSet(setId);
        loadSets();
        showAlert('Set deleted');
      } catch (error) {
        showAlert('Error deleting set: ' + error.message, 'danger');
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
  }

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

      <Row className="mb-4">
        <Col>
          <Card>
            <Card.Header className="bg-primary text-white">
              <h5 className="mb-0">Step 1: Select Workout Groups</h5>
            </Card.Header>
            <Card.Body>
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
              {selectedWorkoutGroups.length === 0 && (
                <p className="text-muted mt-3 mb-0">
                  Select at least one workout group to see available exercises
                </p>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {selectedWorkoutGroups.length > 0 && (
        <>
          <Row className="mb-4">
            <Col>
              <Card>
                <Card.Header className="bg-success text-white">
                  <h5 className="mb-0">Step 2: Add Sets to Exercises</h5>
                </Card.Header>
                <Card.Body>
                  <Form onSubmit={handleAddSet}>
                    <Row>
                      <Col md={4}>
                        <Form.Group className="mb-3">
                          <Form.Label>Exercise</Form.Label>
                          <Form.Select
                            value={selectedExercise}
                            onChange={(e) => setSelectedExercise(e.target.value)}
                            required
                          >
                            <option value="">Select exercise...</option>
                            {availableExercises.map(ex => (
                              <option key={ex.id} value={ex.id}>
                                {ex.name} ({ex.workout_group_name})
                              </option>
                            ))}
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col md={2}>
                        <Form.Group className="mb-3">
                          <Form.Label>Reps</Form.Label>
                          <Form.Control
                            type="number"
                            value={newSetReps}
                            onChange={(e) => setNewSetReps(e.target.value)}
                            placeholder="8"
                            min="1"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={2}>
                        <Form.Group className="mb-3">
                          <Form.Label>RIR</Form.Label>
                          <Form.Control
                            type="number"
                            value={newSetRir}
                            onChange={(e) => setNewSetRir(e.target.value)}
                            placeholder="2"
                            min="0"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={3}>
                        <Form.Group className="mb-3">
                          <Form.Label>Notes</Form.Label>
                          <Form.Control
                            type="text"
                            value={newSetNotes}
                            onChange={(e) => setNewSetNotes(e.target.value)}
                            placeholder="Optional"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={1} className="d-flex align-items-end">
                        <Button type="submit" variant="success" className="mb-3 w-100">
                          Add
                        </Button>
                      </Col>
                    </Row>
                  </Form>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Row>
            <Col>
              <Card>
                <Card.Header className="bg-info text-white">
                  <h5 className="mb-0">Step 3: Review & Edit Sets</h5>
                </Card.Header>
                <Card.Body>
                  {Object.keys(workoutSets).length === 0 ? (
                    <p className="text-muted mb-0">No sets added yet. Use the form above to add sets.</p>
                  ) : (
                    <div className="exercises-list">
                      {Object.entries(workoutSets).map(([exerciseId, exercise]) => (
                        <Card key={exerciseId} className="mb-3">
                          <Card.Header>
                            <div className="d-flex justify-content-between align-items-center">
                              <div>
                                <strong>{exercise.exerciseName}</strong>
                                <Badge bg="secondary" className="ms-2">
                                  {exercise.workoutGroupName}
                                </Badge>
                              </div>
                              {exercise.exerciseNotes && (
                                <small className="text-muted">{exercise.exerciseNotes}</small>
                              )}
                            </div>
                          </Card.Header>
                          <Card.Body className="p-0">
                            <Table striped bordered hover responsive className="mb-0">
                              <thead>
                                <tr>
                                  <th width="10%">Set</th>
                                  <th width="15%">Reps</th>
                                  <th width="15%">RIR</th>
                                  <th width="45%">Notes</th>
                                  <th width="15%">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {exercise.sets.map(set => (
                                  <tr key={set.id}>
                                    <td className="align-middle">{set.set_order}</td>
                                    <td>
                                      <Form.Control
                                        type="number"
                                        value={set.reps || ''}
                                        onChange={(e) => handleUpdateSet(set.id, 'reps', e.target.value ? parseInt(e.target.value) : null)}
                                        size="sm"
                                        min="1"
                                      />
                                    </td>
                                    <td>
                                      <Form.Control
                                        type="number"
                                        value={set.rir || ''}
                                        onChange={(e) => handleUpdateSet(set.id, 'rir', e.target.value ? parseInt(e.target.value) : null)}
                                        size="sm"
                                        min="0"
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
                          </Card.Body>
                        </Card>
                      ))}
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </Container>
  );
}

export default DayWorkout;
