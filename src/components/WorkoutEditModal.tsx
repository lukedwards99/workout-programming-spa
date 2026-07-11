import { type FormEvent, useEffect, useRef } from 'react';
import Modal from 'react-bootstrap/Modal';

export interface WorkoutEditModalProps {
  show: boolean;
  workoutName: string;
  dayOffset: number;
  days: Array<{ value: number; label: string }>;
  busy: boolean;
  onNameChange: (value: string) => void;
  onDayChange: (value: number) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onCopy: () => void;
  onDelete: () => void;
  onHide: () => void;
}

export default function WorkoutEditModal({
  show,
  workoutName,
  dayOffset,
  days,
  busy,
  onNameChange,
  onDayChange,
  onSave,
  onCopy,
  onDelete,
  onHide,
}: WorkoutEditModalProps) {
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (show) {
      setTimeout(() => nameRef.current?.focus(), 0);
    }
  }, [show]);

  const trimmed = workoutName.trim();
  const disabled = !trimmed || busy;

  return (
    <Modal show={show} onHide={onHide} dialogClassName="modal-fullscreen-md-down" centered>
      <Modal.Header closeButton>
        <Modal.Title>Edit Workout</Modal.Title>
      </Modal.Header>
      <form onSubmit={onSave}>
        <Modal.Body>
          <div className="form-group">
            <label htmlFor="edit-workout-name">Workout Name</label>
            <input
              id="edit-workout-name"
              ref={nameRef}
              value={workoutName}
              onChange={(e) => onNameChange(e.target.value)}
              required
              disabled={busy}
            />
          </div>
          <div className="form-group">
            <label htmlFor="edit-workout-day">Day</label>
            <select
              id="edit-workout-day"
              value={dayOffset}
              onChange={(e) => onDayChange(Number(e.target.value))}
              required
              disabled={busy}
            >
              {days.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-outline" onClick={onHide} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={onDelete} disabled={busy}>
            Delete
          </button>
          <button type="button" className="btn btn-outline" onClick={onCopy} disabled={disabled}>
            Copy Workout
          </button>
          <button type="submit" className="btn btn-primary" disabled={disabled}>
            Save Changes
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
