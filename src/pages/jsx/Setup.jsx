import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, ListGroup, Alert, Badge } from 'react-bootstrap';
import {
  getAllWorkoutGroups,
  createWorkoutGroup,
  updateWorkoutGroup,
  deleteWorkoutGroup,
  getAllExercises,
  createExercise,
  updateExercise,
  deleteExercise,
  downloadSetupDataCSV,
  importSetupDataFromCSV,
  clearAllData
} from '../../db/dataService';
import '../css/Setup.css';

function Setup() {
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
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    try {
      const groups = getAllWorkoutGroups();
      const allExercises = getAllExercises();
      setWorkoutGroups(groups);
      setExercises(allExercises);
      
      if (groups.length > 0 && !exerciseGroupId) {
        setExerciseGroupId(groups[0].id);
      }
    } catch (error) {
      showAlert('Error loading data: ' + error.message, 'danger');
    }
  };

  const showAlert = (message, variant = 'success') => {
    setAlert({ message, variant });
    // setTimeout(() => setAlert(null), 5000);
  };

  // Workout Group Handlers
  const handleGroupSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingGroup) {
        await updateWorkoutGroup(editingGroup.id, groupName, groupNotes);
        showAlert('Workout group updated successfully');
      } else {
        await createWorkoutGroup(groupName, groupNotes);
        showAlert('Workout group created successfully');
      }
      
      resetGroupForm();
      // Force a fresh reload of all data
      const groups = getAllWorkoutGroups();
      const allExercises = getAllExercises();
      setWorkoutGroups(groups);
      setExercises(allExercises);
    } catch (error) {
      showAlert('Error saving workout group: ' + error.message, 'danger');
    }
  };

  const handleEditGroup = (group) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupNotes(group.notes || '');
  };

  const handleDeleteGroup = async (id) => {
    if (window.confirm('Are you sure? This will delete all associated exercises and sets.')) {
      try {
        await deleteWorkoutGroup(id);
        showAlert('Workout group deleted successfully');
        // Force a fresh reload
        const groups = getAllWorkoutGroups();
        const allExercises = getAllExercises();
        setWorkoutGroups(groups);
        setExercises(allExercises);
      } catch (error) {
        showAlert('Error deleting workout group: ' + error.message, 'danger');
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
    
    try {
      if (editingExercise) {
        await updateExercise(editingExercise.id, parseInt(exerciseGroupId), exerciseName, exerciseNotes);
        showAlert('Exercise updated successfully');
      } else {
        await createExercise(parseInt(exerciseGroupId), exerciseName, exerciseNotes);
        showAlert('Exercise created successfully');
      }
      
      resetExerciseForm();
      // Force a fresh reload
      const allExercises = getAllExercises();
      setExercises(allExercises);
    } catch (error) {
      showAlert('Error saving exercise: ' + error.message, 'danger');
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
      try {
        await deleteExercise(id);
        showAlert('Exercise deleted successfully');
        // Force a fresh reload
        const allExercises = getAllExercises();
        setExercises(allExercises);
      } catch (error) {
        showAlert('Error deleting exercise: ' + error.message, 'danger');
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

  // Setup Data Export/Import Handlers
  const handleExportSetupData = () => {
    try {
      downloadSetupDataCSV();
      showAlert('Setup data exported successfully!');
    } catch (error) {
      showAlert('Error exporting setup data: ' + error.message, 'danger');
    }
  };

  const handleImportSetupData = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      showAlert('Please upload a CSV file', 'warning');
      return;
    }

    if (!window.confirm('Warning: This will replace all workout groups and exercises. All workout data will be cleared. Continue?')) {
      e.target.value = '';
      return;
    }

    setImporting(true);

    try {
      const text = await file.text();
      const result = await importSetupDataFromCSV(text);
      
      showAlert(`Successfully imported ${result.rowCount} records. Reloading...`, 'success');
      
      // Reload data
      setTimeout(() => {
        loadData();
        setImporting(false);
      }, 1000);
      
      // Clear the file input
      e.target.value = '';
    } catch (error) {
      showAlert('Error importing setup data: ' + error.message, 'danger');
      setImporting(false);
    }
  };
const handleClearAllData = async () => {
    if (!window.confirm('⚠️ WARNING: This will permanently delete ALL data including workout groups, exercises, and all workout data. This action CANNOT be undone. Are you absolutely sure?')) {
      return;
    }

    if (!window.confirm('This is your last chance. Click OK to permanently delete everything.')) {
      return;
    }

    try {
      await clearAllData();
      showAlert('All data cleared successfully. The database has been reset.', 'success');
      // Reload to show empty state
      setTimeout(() => {
        loadData();
      }, 1000);
    } catch (error) {
      showAlert('Error clearing all data: ' + error.message, 'danger');
    }
  };

  
  return (
    <Container className="setup-page py-4">
      {alert && (
        <Alert variant={alert.variant} dismissible onClose={() => setAlert(null)}>
          {alert.message}
        </Alert>
      )}
      
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">Setup Workout Groups & Exercises</h1>
        <div className="d-flex gap-2">
          <Button variant="outline-primary" onClick={handleExportSetupData}>
            Export Setup
          </Button>
          <Button 
            variant="outline-secondary" 
            as="label" 
            htmlFor="setup-import-file"
            disabled={importing}
          >
            {importing ? 'Importing...' : 'Import Setup'}
          </Button>
          <input
            id="setup-import-file"
            type="file"
            accept=".csv"
            onChange={handleImportSetupData}
            style={{ display: 'none' }}
            disabled={importing}
          />
        </div>
      </div>
      
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
                        <Badge bg="secondary" className="me-2">
                          {exercise.workout_group_name}
                        </Badge>
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

      {/* Danger Zone */}
      <Row className="mt-4">
        <Col>
          <Card className="border-danger">
            <Card.Header className="bg-danger text-white">
              <h5 className="mb-0">Danger Zone</h5>
            </Card.Header>
            <Card.Body>
              <h6>Reset Entire Database</h6>
              <p className="text-muted mb-3">
                <strong>⚠️ WARNING:</strong> This will permanently delete ALL data including all workout groups, 
                exercises, and all workout data. This action cannot be undone. Only use this if you want to 
                start completely fresh.
              </p>
              <Button variant="danger" onClick={handleClearAllData}>
                Clear All Data (Reset Database)
              </Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default Setup;
