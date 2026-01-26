import React from 'react';
import { Card, Badge, Button } from 'react-bootstrap';
import ExerciseSetTable from './ExerciseSetTable';

function ExerciseCard({ 
  dayExercise, 
  index, 
  isFirst, 
  isLast,
  onMoveUp, 
  onMoveDown, 
  onAddSet, 
  onUpdateSet,
  onDeleteSet,
  onDeleteExercise 
}) {
  return (
    <Card className="mb-3">
      <Card.Header className="d-flex justify-content-between align-items-center">
        <div>
          <Badge bg="secondary" className="me-2">
            #{index + 1}
          </Badge>
          <strong>{dayExercise.exerciseName}</strong>
          <Badge bg="info" className="ms-2">
            {dayExercise.workoutGroupName}
          </Badge>
          {dayExercise.exerciseNotes && (
            <small className="text-muted ms-2">({dayExercise.exerciseNotes})</small>
          )}
        </div>
        <div className="d-flex gap-2">
          <div className="d-flex gap-1">
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => onMoveUp(index)}
              disabled={isFirst}
              title="Move up"
            >
              ↑
            </Button>
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => onMoveDown(index)}
              disabled={isLast}
              title="Move down"
            >
              ↓
            </Button>
          </div>
          <Button
            size="sm"
            variant="success"
            onClick={() => onAddSet(dayExercise.dayExerciseId)}
          >
            + Add Set
          </Button>
          <Button
            size="sm"
            variant="outline-danger"
            onClick={() => onDeleteExercise(dayExercise.dayExerciseId, dayExercise.exerciseName)}
          >
            Remove Exercise
          </Button>
        </div>
      </Card.Header>
      <Card.Body className="p-0">
        <ExerciseSetTable
          sets={dayExercise.sets}
          dayExerciseId={dayExercise.dayExerciseId}
          onUpdateSet={onUpdateSet}
          onDeleteSet={onDeleteSet}
          onAddSet={onAddSet}
        />
      </Card.Body>
    </Card>
  );
}

export default ExerciseCard;
