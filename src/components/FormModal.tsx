import { useId, useState, type ReactNode, type FormEvent } from 'react';
import Modal from 'react-bootstrap/Modal';

export interface FormModalProps {
  show: boolean;
  onHide: () => void;
  title: string;
  children: ReactNode;
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void | Promise<void>;
  submitLabel?: string;
  submitDisabled?: boolean;
}
export default function FormModal({ show, onHide, title, children, onSubmit, submitLabel = 'Save', submitDisabled = false }: FormModalProps) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const id = useId();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy || !onSubmit) return;
    setBusy(true); setError('');
    try { await onSubmit(e); } catch (reason) { setError((reason as Error).message); } finally { setBusy(false); }
  }
  // Existing page field groups receive explicit label associations in one place.
  function labelFields(form: HTMLFormElement | null) {
    form?.querySelectorAll('.form-group').forEach((group, index) => {
      const input = group.querySelector<HTMLInputElement>('input, select, textarea');
      const label = group.querySelector('label');
      if (input && label) { input.id ||= `${id}-${index}`; label.htmlFor = input.id; }
    });
  }
  const body = <Modal.Body>{children}{error && <p className="alert alert-danger mt-3" role="alert">{error}</p>}</Modal.Body>;
  const footer = <Modal.Footer><button type="button" className="btn btn-outline" disabled={busy} onClick={onHide}>{onSubmit ? 'Cancel' : 'Close'}</button>{onSubmit && <button type="submit" className="btn btn-primary" disabled={busy || submitDisabled}>{busy ? 'Saving…' : submitLabel}</button>}</Modal.Footer>;
  return <Modal show={show} onHide={() => !busy && onHide()} onEnter={() => setError('')} centered>
    <Modal.Header closeButton={!busy}><Modal.Title>{title}</Modal.Title></Modal.Header>
    {onSubmit ? <form onSubmit={submit} ref={labelFields}>{body}{footer}</form> : <div>{body}{footer}</div>}
  </Modal>;
}
