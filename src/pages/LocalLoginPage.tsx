import { useEffect, useState } from 'react';
import { sessionApi } from '../api/sessionApi';
import type { LocalUser } from '../types/cloud';
import { useSession } from '../contexts/SessionContext';

export default function LocalLoginPage() {
  const { login } = useSession();
  const [users, setUsers] = useState<LocalUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sessionApi.localUsers().then(setUsers).catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="loading-screen local-login-screen">
      <div className="local-login-card">
        <h1>LiftLog Local</h1>
        <p>Select a beta persona. This login is available only in local development.</p>
        {error && <div className="alert alert-danger">{error}</div>}
        {loading ? <p>Loading local users…</p> : (
          <div className="local-user-list">
            {users.map((user) => (
              <button className="btn btn-outline local-user-button" key={user.id} onClick={async () => { try { await login(user.id); } catch (reason) { setError((reason as Error).message); } }}>
                <strong>{user.display_name}</strong>
                <span>{user.email_display}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
