import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Container, Row, Col, Card, Button, Alert 
} from 'react-bootstrap';
import {
  daysApi,
  workoutGroupsApi,
  dayWorkoutGroupsApi,
  exercisesApi,
  dayExercisesApi,
  setsApi
} from '../../api/workoutApi';
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
            weight: set.weight,
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

  const handleMoveExerciseUp = async (index) => {
    if (index === 0) return; // Already at top
    
    const currentExercise = dayExercises[index];
    const previousExercise = dayExercises[index - 1];
    
    // Swap the exercise_order values
    const response1 = await dayExercisesApi.update(currentExercise.dayExerciseId, {
      exerciseId: currentExercise.exerciseId,
      exerciseOrder: previousExercise.exerciseOrder
    });
    
    const response2 = await dayExercisesApi.update(previousExercise.dayExerciseId, {
      exerciseId: previousExercise.exerciseId,
      exerciseOrder: currentExercise.exerciseOrder
    });
    
    if (response1.success && response2.success) {
      loadData();
      showAlert('Exercise order updated');
    } else {
      showAlert(response1.error || response2.error, 'danger');
    }
  };

  const handleMoveExerciseDown = async (index) => {
    if (index === dayExercises.length - 1) return; // Already at bottom
    
    const currentExercise = dayExercises[index];
    const nextExercise = dayExercises[index + 1];
    
    // Swap the exercise_order values
    const response1 = await dayExercisesApi.update(currentExercise.dayExerciseId, {
      exerciseId: currentExercise.exerciseId,
      exerciseOrder: nextExercise.exerciseOrder
    });
    
    const response2 = await dayExercisesApi.update(nextExercise.dayExerciseId, {
      exerciseId: nextExercise.exerciseId,
      exerciseOrder: currentExercise.exerciseOrder
    });
    
    if (response1.success && response2.success) {
      loadData();
      showAlert('Exercise order updated');
    } else {
      showAlert(response1.error || response2.error, 'danger');
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
                    key={dayEx.dayExerciseId}
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
