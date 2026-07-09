import Modal from 'react-bootstrap/Modal';

export default function ConfirmModal({ show, onHide, onConfirm, title, message, confirmLabel = 'Delete', variant = 'danger' }) {
  return (
    <Modal show={show} onHide={onHide} dialogClassName="modal-fullscreen-md-down" centered>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p style={{ margin: 0 }}>{message}</p>
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="btn btn-outline" onClick={onHide}>Cancel</button>
        <button
          type="button"
          className={`btn btn-${variant}`}
          onClick={() => { onConfirm(); onHide(); }}
        >
          {confirmLabel}
        </button>
      </Modal.Footer>
    </Modal>
  );
}
