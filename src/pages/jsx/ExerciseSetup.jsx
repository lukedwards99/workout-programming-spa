import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, ListGroup, Alert, Badge } from 'react-bootstrap';
import {
  workoutGroupsApi,
  exercisesApi
} from '../../api';
import '../css/Setup.css';

function ExerciseSetup() {
  const [workoutGroups, setWorkoutGroups] = useState([]);
  const [exercises, setExercises] = useState([]);
  
  // Workout Group Form State
  const [groupName, setGroupName] = useState('');
  const [groupNotes, setGroupNotes] = useState('');
  const [editingGroup, setEditingGroup] = useState(null);
  
  // Exercise Form State
  const [exerciseName, setExerciseName] = useState('');
  const [exerciseNotes, setExerciseNotes] = useState('');
  const [exerciseGroupId, setExerciseGroupId] = useState('');
  const [editingExercise, setEditingExercise] = useState(null);
  
  // UI State
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const groupsResponse = await workoutGroupsApi.getAll();
    const exercisesResponse = await exercisesApi.getAll();
    
    if (groupsResponse.success) {
      setWorkoutGroups(groupsResponse.data);
      if (groupsResponse.data.length > 0 && !exerciseGroupId) {
        setExerciseGroupId(groupsResponse.data[0].id);
      }
    } else {
      showAlert(groupsResponse.error, 'danger');
    }
    
    if (exercisesResponse.success) {
      setExercises(exercisesResponse.data);
    } else {
      showAlert(exercisesResponse.error, 'danger');
    }
  };

  const showAlert = (message, variant = 'success') => {
    setAlert({ message, variant });
    // setTimeout(() => setAlert(null), 5000);
  };

  // Workout Group Handlers
  const handleGroupSubmit = async (e) => {
    e.preventDefault();
    
    let response;
    if (editingGroup) {
      response = await workoutGroupsApi.update(editingGroup.id, { name: groupName, notes: groupNotes });
    } else {
      response = await workoutGroupsApi.create({ name: groupName, notes: groupNotes });
    }
    
    if (response.success) {
      showAlert(response.message);
      resetGroupForm();
      loadData();
    } else {
      showAlert(response.error, 'danger');
    }
  };

  const handleEditGroup = (group) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupNotes(group.notes || '');
  };

  const handleDeleteGroup = async (id) => {
    if (window.confirm('Are you sure? This will delete all associated exercises and sets.')) {
      const response = await workoutGroupsApi.delete(id);
      
      if (response.success) {
        showAlert('Workout group deleted successfully');
        loadData();
      } else {
        showAlert(response.error, 'danger');
      }
    }
  };

  const resetGroupForm = () => {
    setEditingGroup(null);
    setGroupName('');
    setGroupNotes('');
  };

  // Exercise Handlers
  const handleExerciseSubmit = async (e) => {
    e.preventDefault();
    
    let response;
    if (editingExercise) {
      response = await exercisesApi.update(editingExercise.id, { 
        workoutGroupId: parseInt(exerciseGroupId), 
        name: exerciseName, 
        notes: exerciseNotes 
      });
    } else {
      response = await exercisesApi.create({ 
        workoutGroupId: parseInt(exerciseGroupId), 
        name: exerciseName, 
        notes: exerciseNotes 
      });
    }
    
    if (response.success) {
      showAlert(response.message);
      resetExerciseForm();
      loadData();
    } else {
      showAlert(response.error, 'danger');
    }
  };

  const handleEditExercise = (exercise) => {
    setEditingExercise(exercise);
    setExerciseName(exercise.name);
    setExerciseNotes(exercise.notes || '');
    setExerciseGroupId(exercise.workout_group_id);
  };

  const handleDeleteExercise = async (id) => {
    if (window.confirm('Are you sure? This will delete all associated sets.')) {
      const response = await exercisesApi.delete(id);
      
      if (response.success) {
        showAlert('Exercise deleted successfully');
        loadData();
      } else {
        showAlert(response.error, 'danger');
      }
    }
  };

  const resetExerciseForm = () => {
    setEditingExercise(null);
    setExerciseName('');
    setExerciseNotes('');
  };

  const filteredExercises = exerciseGroupId
    ? exercises.filter(ex => ex.workout_group_id === parseInt(exerciseGroupId))
    : exercises;

  return (
    <Container className="setup-page py-4">
      {alert && (
        <Alert variant={alert.variant} dismissible onClose={() => setAlert(null)}>
          {alert.message}
        </Alert>
      )}
      
      <h1 className="mb-4">Setup Workout Groups & Exercises</h1>
      
      <Row>
        {/* Workout Groups Section */}
        <Col md={6} className="mb-4">
          <Card>
            <Card.Header className="bg-primary text-white">
              <h4 className="mb-0">Workout Groups</h4>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleGroupSubmit} className="mb-3">
                <Form.Group className="mb-2">
                  <Form.Label>Name</Form.Label>
                  <Form.Control
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g., Chest, Back, Legs"
                    required
                  />
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Notes</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={groupNotes}
                    onChange={(e) => setGroupNotes(e.target.value)}
                    placeholder="Optional notes"
                  />
                </Form.Group>
                
                <div className="d-flex gap-2">
                  <Button type="submit" variant="primary">
                    {editingGroup ? 'Update' : 'Add'} Group
                  </Button>
                  {editingGroup && (
                    <Button variant="secondary" onClick={resetGroupForm}>
                      Cancel
                    </Button>
                  )}
                </div>
              </Form>
              
              <ListGroup>
                {workoutGroups.map(group => (
                  <ListGroup.Item
                    key={group.id}
                    className="d-flex justify-content-between align-items-start"
                  >
                    <div className="flex-grow-1">
                      <strong>{group.name}</strong>
                      {group.notes && <div className="small text-muted">{group.notes}</div>}
                    </div>
                    <div className="d-flex gap-2">
                      <Button
                        size="sm"
                        variant="outline-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditGroup(group);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGroup(group.id);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </Card.Body>
          </Card>
        </Col>
        
        {/* Exercises Section */}
        <Col md={6} className="mb-4">
          <Card>
            <Card.Header className="bg-success text-white">
              <h4 className="mb-0">Exercises</h4>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleExerciseSubmit} className="mb-3">
                <Form.Group className="mb-2">
                  <Form.Label>Workout Group</Form.Label>
                  <Form.Select
                    value={exerciseGroupId}
                    onChange={(e) => setExerciseGroupId(e.target.value)}
                    required
                  >
                    <option value="">Select a workout group</option>
                    {workoutGroups.map(group => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                
                <Form.Group className="mb-2">
                  <Form.Label>Exercise Name</Form.Label>
                  <Form.Control
                    type="text"
                    value={exerciseName}
                    onChange={(e) => setExerciseName(e.target.value)}
                    placeholder="e.g., Bench Press, Squats"
                    required
                  />
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Notes</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={exerciseNotes}
                    onChange={(e) => setExerciseNotes(e.target.value)}
                    placeholder="Optional notes"
                  />
                </Form.Group>
                
                <div className="d-flex gap-2">
                  <Button type="submit" variant="success">
                    {editingExercise ? 'Update' : 'Add'} Exercise
                  </Button>
                  {editingExercise && (
                    <Button variant="secondary" onClick={resetExerciseForm}>
                      Cancel
                    </Button>
                  )}
                </div>
              </Form>
              
              {exerciseGroupId && (
                <div className="mb-2">
                  <Badge bg="info">
                    Showing exercises for: {workoutGroups.find(g => g.id === parseInt(exerciseGroupId))?.name}
                  </Badge>
                </div>
              )}
              
              <ListGroup>
                {filteredExercises.map(exercise => (
                  <ListGroup.Item
                    key={exercise.id}
                    className="d-flex justify-content-between align-items-start"
                  >
                    <div className="flex-grow-1">
                      <strong>{exercise.name}</strong>
                      <div className="small text-muted">
                        {exercise.notes}
                      </div>
                    </div>
                    <div className="d-flex gap-2">
                      <Button
                        size="sm"
                        variant="outline-success"
                        onClick={() => handleEditExercise(exercise)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={() => handleDeleteExercise(exercise.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default ExerciseSetup;
