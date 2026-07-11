import type { ReactNode, FormEvent } from 'react';
import Modal from 'react-bootstrap/Modal';

export interface FormModalProps {
  show: boolean;
  onHide: () => void;
  title: string;
  children: ReactNode;
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  submitLabel?: string;
  submitDisabled?: boolean;
}

export default function FormModal({ show, onHide, title, children, onSubmit, submitLabel = 'Save', submitDisabled = false }: FormModalProps) {
  return (
    <Modal show={show} onHide={onHide} dialogClassName="modal-fullscreen-md-down" centered>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <form onSubmit={onSubmit}>
        <Modal.Body>{children}</Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-outline" onClick={onHide}>Cancel</button>
          {onSubmit && <button type="submit" className="btn btn-primary" disabled={submitDisabled}>{submitLabel}</button>}
        </Modal.Footer>
      </form>
    </Modal>
  );
}
