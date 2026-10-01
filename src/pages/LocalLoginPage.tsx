import { useEffect, useState } from 'react';
import { sessionApi } from '../api/sessionApi';
import type { LocalUser } from '../types/cloud';
import { useSession } from '../contexts/SessionContext';
import Icon from '../components/Icon';

export default function LocalLoginPage() {
  const { login } = useSession();
  const [users, setUsers] = useState<LocalUser[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  function load() { setLoading(true); sessionApi.localUsers().then(setUsers).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)); }
  useEffect(load, []);
  return <main className="login-layout">
    <section className="login-story"><div className="brand"><span className="brand-mark"><Icon name="barbell" /></span>LiftLog<span className="brand-period">.</span></div><div><h1>Every set,<br />with purpose.</h1><p>Your programs, your progress, your next session.<br />A clear place to put the work in.</p></div><span className="login-signoff">Plan thoughtfully. Train consistently.</span></section>
    <section className="login-panel"><div className="login-content"><h2>Make yourself at home.</h2><p className="muted">Choose a test account to explore LiftLog. Each email has its own role and program access.</p><span className="test-tag">Local development</span>
      {error && <div className="alert alert-danger" role="alert">{error} <button className="inline-link" onClick={load}>Retry</button></div>}
      {loading ? <p role="status">Loading test accounts…</p> : <div className="persona-list">{users.map((user) => <button key={user.id} disabled={busy} className="persona-option" onClick={async () => { setBusy(true); try { await login(user.id); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}><span className="avatar">{user.display_name.split(' ').map((n) => n[0]).slice(0, 2).join('')}</span><span className="persona-name"><strong>{user.display_name}</strong><span>{user.email_display}</span></span><Icon name="arrow" /></button>)}</div>}
      <div className="identity-note"><Icon name="shield" /><span>This test login runs on your local Cloudflare Worker. Hosted sign-in uses Cloudflare Access.</span></div>
    </div></section>
  </main>;
}
