import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from 'react-bootstrap/Modal';
import { sessionApi } from '../api/sessionApi';
import { useSession } from '../contexts/SessionContext';
import type { LocalUser } from '../types/cloud';
import Icon from './Icon';

export default function TestUserSwitcher() {
  const { principal, switchUser, resetUser } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<LocalUser[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  useEffect(() => {
    if (!open) return;
    setLoading(true); setError('');
    sessionApi.testUsers().then(setUsers).catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  }, [open]);
  if (!principal?.testing?.canSwitch) return null;
  async function select(userId?: string) {
    setBusy(true); setError('');
    try {
      if (userId) await switchUser(userId); else await resetUser();
      navigate('/'); setOpen(false);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <>
    <button className="test-switch-button" onClick={() => setOpen(true)}><Icon name="switch" /> <span>Switch test user</span></button>
    <Modal show={open} onHide={() => !busy && setOpen(false)} centered>
      <Modal.Header closeButton={!busy}><Modal.Title>Test another account</Modal.Title></Modal.Header>
      <Modal.Body>
        <p className="muted">Choose an email to use its workspace access and permissions.</p>
        <div className="identity-note"><Icon name="shield" /><span>Authenticated as <strong>{principal.testing.authenticatedEmail}</strong></span></div>
        <label className="search-box"><Icon name="search" /><input aria-label="Find test account" placeholder="Find a name or email" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        {error && <p className="alert alert-danger" role="alert">{error}</p>}
        {loading ? <p role="status">Loading accounts…</p> : <div className="persona-list">{users.filter((user) => `${user.display_name} ${user.email_display}`.toLowerCase().includes(search.toLowerCase())).map((user) => <button disabled={busy} key={user.id} className={`persona-option ${principal.userId === user.id ? 'selected' : ''}`} onClick={() => void select(user.id)}>
          <span className="avatar">{user.display_name.split(' ').map((n) => n[0]).slice(0, 2).join('')}</span><span className="persona-name"><strong>{user.display_name}</strong><span>{user.email_display}</span><small>{user.roles ?? 'No workspace'}{user.status === 'invited' ? ' · invited test account' : ''}</small></span>{principal.userId === user.id ? <Icon name="check" /> : <Icon name="chevron" />}
        </button>)}{!users.some((u) => `${u.display_name} ${u.email_display}`.toLowerCase().includes(search.toLowerCase())) && <p className="muted">No accounts match. Try another name or email.</p>}</div>}
      </Modal.Body>
      <Modal.Footer><span className="muted">{busy ? 'Switching account…' : 'Temporary test session'}</span>{principal.testing.isImpersonating && <button className="btn btn-outline" disabled={busy} onClick={() => void select()}>Return to my account</button>}</Modal.Footer>
    </Modal>
  </>;
}
