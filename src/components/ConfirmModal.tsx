import { useState } from 'react';
import Modal from 'react-bootstrap/Modal';

export interface ConfirmModalProps {
  show: boolean;
  onHide: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: string;
}

export default function ConfirmModal({ show, onHide, onConfirm, title, message, confirmLabel = 'Delete', variant = 'danger' }: ConfirmModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm();
      onHide();
    } catch (err) {
      setError((err as Error).message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal show={show} onHide={isSubmitting ? () => {} : onHide} dialogClassName="modal-fullscreen-md-down" centered>
      <Modal.Header closeButton={!isSubmitting}>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p style={{ margin: 0 }}>{message}</p>
        {error && <p style={{ marginTop: 12, color: 'var(--danger)' }}>{error}</p>}
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="btn btn-outline" onClick={onHide} disabled={isSubmitting}>Cancel</button>
        <button
          type="button"
          className={`btn btn-${variant}`}
          onClick={handleConfirm}
          disabled={isSubmitting}
        >
          {isSubmitting ? `${confirmLabel.replace(/e$/, '')}ing...` : confirmLabel}
        </button>
      </Modal.Footer>
    </Modal>
  );
}
