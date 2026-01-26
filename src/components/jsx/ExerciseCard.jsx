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
      <Card.Header>
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
          <div className="w-100 w-md-auto">
            <Badge bg="secondary" className="me-2">
              #{index + 1}
            </Badge>
            <strong>{dayExercise.exerciseName}</strong>
            <Badge bg="info" className="ms-2">
              {dayExercise.workoutGroupName}
            </Badge>
            {dayExercise.exerciseNotes && (
              <small className="text-muted ms-2 d-block d-sm-inline mt-1 mt-sm-0">
                ({dayExercise.exerciseNotes})
              </small>
            )}
          </div>
          <div className="d-flex flex-column flex-sm-row gap-2 w-100 w-md-auto">
            <div className="d-flex gap-1">
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => onMoveUp(index)}
                disabled={isFirst}
                title="Move up"
                className="flex-fill flex-sm-grow-0"
              >
                ↑
              </Button>
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={() => onMoveDown(index)}
                disabled={isLast}
                title="Move down"
                className="flex-fill flex-sm-grow-0"
              >
                ↓
              </Button>
            </div>
            <Button
              size="sm"
              variant="success"
              onClick={() => onAddSet(dayExercise.dayExerciseId)}
              className="flex-fill flex-sm-grow-0"
            >
              + Add Set
            </Button>
            <Button
              size="sm"
              variant="outline-danger"
              onClick={() => onDeleteExercise(dayExercise.dayExerciseId, dayExercise.exerciseName)}
              className="flex-fill flex-sm-grow-0"
            >
              Remove Exercise
            </Button>
          </div>
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
