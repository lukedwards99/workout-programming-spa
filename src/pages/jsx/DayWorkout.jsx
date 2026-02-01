import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Container, Row, Col, Card, Button, Alert, Form 
} from 'react-bootstrap';
import {
  daysApi,
  workoutGroupsApi,
  dayWorkoutGroupsApi,
  exercisesApi,
  workoutSetsApi
} from '../../api';
import WorkoutGroupSelector from '../../components/jsx/WorkoutGroupSelector';
import ExerciseAddForm from '../../components/jsx/ExerciseAddForm';
import ExerciseCard from '../../components/jsx/ExerciseCard';
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
  const [dayNotes, setDayNotes] = useState('');
  const [notesCollapsed, setNotesCollapsed] = useState(true);
  
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
    const setsGroupedResponse = await workoutSetsApi.getByDayGrouped(parseInt(dayId));
    
    if (dayResponse.success) {
      setDay(dayResponse.data);
      setDayNotes(dayResponse.data.notes || '');
      // Collapse notes section if empty, expand if has content
      setNotesCollapsed(!dayResponse.data.notes || dayResponse.data.notes.trim() === '');
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
    
    if (setsGroupedResponse.success) {
      // Transform the data to match the expected format
      const exercisesWithSets = setsGroupedResponse.data.map(group => ({
        exerciseId: group.exercise_id,
        exerciseName: group.exercise_name,
        workoutGroupName: group.workout_group_name,
        exerciseNotes: group.exercise_notes || '',
        exerciseOrder: group.exercise_order,
        sets: group.sets
      }));
      
      setDayExercises(exercisesWithSets);
    } else {
      showAlert(setsGroupedResponse.error, 'danger');
    }
  };

  const showAlert = (message, variant = 'success') => {
    setAlert({ message, variant });
  };

  const handleNotesBlur = async () => {
    // Only save if notes have changed
    if (dayNotes !== (day.notes || '')) {
      const response = await daysApi.updateNotes(parseInt(dayId), dayNotes);
      
      if (response.success) {
        // Update local day object
        setDay({ ...day, notes: dayNotes });
        showAlert('Notes saved', 'success');
      } else {
        showAlert(response.error, 'danger');
      }
    }
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

  const handleAddExercise = async (e) => {
    e.preventDefault();
    
    if (!selectedExercise) {
      showAlert('Please select an exercise', 'warning');
      return;
    }
    
    // Create the first set for this exercise (requirement: every exercise needs one set)
    const response = await workoutSetsApi.create({
      dayId: parseInt(dayId),
      exerciseId: parseInt(selectedExercise),
      reps: null,
      weight: null,
      rir: null,
      notes: ''
    });
    
    if (response.success) {
      setShowExerciseAdd(false);
      setSelectedExercise('');
      loadData();
      showAlert('Exercise added with first set');
    } else {
      showAlert(response.error, 'danger');
    }
  };

  const handleDeleteExercise = async (exerciseId, exerciseName) => {
    if (window.confirm(`Remove "${exerciseName}" and all its sets from this day?`)) {
      const response = await workoutSetsApi.deleteByDayAndExercise(parseInt(dayId), exerciseId);
      
      if (response.success) {
        loadData();
        showAlert('Exercise removed successfully');
      } else {
        showAlert(response.error, 'danger');
      }
    }
  };

  const handleAddSet = async (exerciseId) => {
    const response = await workoutSetsApi.create({
      dayId: parseInt(dayId),
      exerciseId: exerciseId,
      reps: null,
      weight: null,
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
      weight: set.weight,
      rir: set.rir,
      notes: set.notes || '',
      [field]: value
    };
    
    const response = await workoutSetsApi.update(setId, updates);
    
    if (response.success) {
      loadData();
    } else {
      showAlert(response.error, 'danger');
    }
  };

  const handleDeleteSet = async (setId, exerciseId) => {
    // Check if this is the last set for the exercise
    const exercise = dayExercises.find(ex => ex.exerciseId === exerciseId);
    if (exercise && exercise.sets.length === 1) {
      showAlert('Cannot delete the last set. Every exercise must have at least one set. Delete the exercise instead.', 'warning');
      return;
    }
    
    if (window.confirm('Delete this set?')) {
      const response = await workoutSetsApi.delete(setId);
      
      if (response.success) {
        loadData();
        showAlert('Set deleted');
      } else {
        showAlert(response.error, 'danger');
      }
    }
  };

  const handleMoveExerciseUp = async (index) => {
    if (index === 0) return; // Already at top
    
    const currentExercise = dayExercises[index];
    const previousExercise = dayExercises[index - 1];
    
    // Update exercise_order for all sets in both exercises
    const currentSets = currentExercise.sets.map(set => ({ ...set, exerciseOrder: previousExercise.exerciseOrder }));
    const previousSets = previousExercise.sets.map(set => ({ ...set, exerciseOrder: currentExercise.exerciseOrder }));
    
    try {
      // Update all sets for current exercise
      for (const set of currentSets) {
        await workoutSetsApi.update(set.id, {
          exerciseOrder: previousExercise.exerciseOrder,
          setOrder: set.set_order,
          reps: set.reps,
          weight: set.weight,
          rir: set.rir,
          notes: set.notes || ''
        });
      }
      
      // Update all sets for previous exercise
      for (const set of previousSets) {
        await workoutSetsApi.update(set.id, {
          exerciseOrder: currentExercise.exerciseOrder,
          setOrder: set.set_order,
          reps: set.reps,
          weight: set.weight,
          rir: set.rir,
          notes: set.notes || ''
        });
      }
      
      loadData();
      showAlert('Exercise order updated');
    } catch (error) {
      showAlert('Failed to update exercise order', 'danger');
    }
  };

  const handleMoveExerciseDown = async (index) => {
    if (index === dayExercises.length - 1) return; // Already at bottom
    
    const currentExercise = dayExercises[index];
    const nextExercise = dayExercises[index + 1];
    
    // Update exercise_order for all sets in both exercises
    const currentSets = currentExercise.sets.map(set => ({ ...set, exerciseOrder: nextExercise.exerciseOrder }));
    const nextSets = nextExercise.sets.map(set => ({ ...set, exerciseOrder: currentExercise.exerciseOrder }));
    
    try {
      // Update all sets for current exercise
      for (const set of currentSets) {
        await workoutSetsApi.update(set.id, {
          exerciseOrder: nextExercise.exerciseOrder,
          setOrder: set.set_order,
          reps: set.reps,
          weight: set.weight,
          rir: set.rir,
          notes: set.notes || ''
        });
      }
      
      // Update all sets for next exercise
      for (const set of nextSets) {
        await workoutSetsApi.update(set.id, {
          exerciseOrder: currentExercise.exerciseOrder,
          setOrder: set.set_order,
          reps: set.reps,
          weight: set.weight,
          rir: set.rir,
          notes: set.notes || ''
        });
      }
      
      loadData();
      showAlert('Exercise order updated');
    } catch (error) {
      showAlert('Failed to update exercise order', 'danger');
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

      {/* Day Notes Section */}
      <Row className="mb-4">
        <Col>
          <Card>
            <Card.Header 
              className="d-flex justify-content-between align-items-center" 
              style={{ cursor: 'pointer' }}
              onClick={() => setNotesCollapsed(!notesCollapsed)}
            >
              <h6 className="mb-0">
                {notesCollapsed ? '▶' : '▼'} Day Notes
              </h6>
              <small className="text-muted">
                {dayNotes.trim() ? `(${dayNotes.length} characters)` : '(Click to add notes)'}
              </small>
            </Card.Header>
            {!notesCollapsed && (
              <Card.Body>
                <Form.Control
                  as="textarea"
                  rows={3}
                  placeholder="Add notes for this workout day (e.g., 'Focus on form', 'Deload week', etc.)..."
                  value={dayNotes}
                  onChange={(e) => setDayNotes(e.target.value)}
                  onBlur={handleNotesBlur}
                />
              </Card.Body>
            )}
          </Card>
        </Col>
      </Row>

      {/* Workout Groups Selection */}
      <Row className="mb-4">
        <Col>
          <WorkoutGroupSelector
            allWorkoutGroups={allWorkoutGroups}
            selectedWorkoutGroups={selectedWorkoutGroups}
            onToggle={handleWorkoutGroupToggle}
          />
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
                <ExerciseAddForm
                  allExercises={allExercises}
                  selectedWorkoutGroups={selectedWorkoutGroups}
                  selectedExercise={selectedExercise}
                  onExerciseChange={setSelectedExercise}
                  onSubmit={handleAddExercise}
                  onCancel={() => setShowExerciseAdd(false)}
                />
              )}

              {/* Exercise List */}
              {dayExercises.length === 0 ? (
                <p className="text-muted mb-0 text-center py-4">
                  No exercises added yet. Click "Add Exercise" to get started.
                </p>
              ) : (
                dayExercises.map((dayEx, index) => (
                  <ExerciseCard
                    key={dayEx.exerciseId}
                    dayExercise={dayEx}
                    index={index}
                    isFirst={index === 0}
                    isLast={index === dayExercises.length - 1}
                    onMoveUp={handleMoveExerciseUp}
                    onMoveDown={handleMoveExerciseDown}
                    onAddSet={handleAddSet}
                    onUpdateSet={handleUpdateSet}
                    onDeleteSet={handleDeleteSet}
                    onDeleteExercise={handleDeleteExercise}
                  />
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
