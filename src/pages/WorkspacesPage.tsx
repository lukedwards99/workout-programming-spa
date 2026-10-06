import { Navigate, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState, type FormEvent } from 'react';
import { adminApi, type WorkspaceRow } from '../api/cloudApi';
import { ApiClientError } from '../api/http';
import { useSession } from '../contexts/SessionContext';
import { groupSpaces, spaceAccessLabel } from '../utils/spacePresentation';

export default function WorkspacesPage() {
  const navigate = useNavigate();
  const { principal, workspaceId, setWorkspaceId, refresh } = useSession();
  const [rows, setRows] = useState<WorkspaceRow[]>([]);
  const [name, setName] = useState(''), [teamName, setTeamName] = useState('');
  const [confirm, setConfirm] = useState<Record<string, string>>({});
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const isAdmin = Boolean(principal?.platformRoles.includes('admin'));
  const canCreate = isAdmin || Boolean(principal?.memberships.some(item => item.status === 'active' && item.kind === 'organization' && ['owner', 'coach'].includes(item.role)));
  async function load() {
    try { setRows(await adminApi.workspaces()); setError(''); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : 'Unable to load spaces.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (canCreate || !workspaceId) void load(); }, []);
  async function create(e: FormEvent, kind: 'personal' | 'organization') {
    e.preventDefault();
    const value = kind === 'personal' ? name : teamName;
    if (!value.trim()) return;
    setBusy(true);
    try {
      const row = await adminApi.createWorkspace(value.trim(), kind);
      localStorage.setItem('liftlog-workspace-id', row.id);
      await refresh(); await load(); setName(''); setTeamName('');
    } catch (e) { setError(e instanceof ApiClientError ? e.message : 'Unable to create space.'); }
    finally { setBusy(false); }
  }
  async function remove(row: WorkspaceRow) {
    setBusy(true);
    try {
      await adminApi.deleteWorkspace(row.id, confirm[row.id] ?? '');
      if (workspaceId === row.id) localStorage.removeItem('liftlog-workspace-id');
      await refresh(); await load();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : 'Unable to delete space.'); }
    finally { setBusy(false); }
  }
  if (!canCreate && workspaceId) return <Navigate to="/" replace />;
  const groups = groupSpaces(rows.map(row => ({ ...row, personalOwnerUserId: row.personal_owner_user_id })), principal!.userId);
  const descriptions: Record<string, string> = {
    mine: 'Private spaces for your own training, templates, and coaching work. No client is attached.',
    clients: 'Each client keeps one space. Assigning a coach gives them access; changing coaches preserves the client’s training history.',
    team: 'Your organization roster, coach assignments, and shared team programming.',
    other: 'Personal spaces available through your administrator access.',
  };
  return <section className="page-section">
    <div className="page-header"><div><h1>Spaces</h1><p className="page-subtitle">Spaces for your own work and each client’s training.</p></div></div>
    {error && <div className="alert alert-danger" role="alert">{error} <button className="inline-link" onClick={() => void load()}>Retry</button></div>}
    {loading ? <p role="status">Loading spaces…</p> : groups.filter(group => group.key !== 'other' || group.spaces.length).map(group => <section className="space-section" aria-labelledby={`spaces-${group.key}`} key={group.key}>
      <div className="space-section-heading"><div><h2 id={`spaces-${group.key}`}>{group.label}</h2><p>{descriptions[group.key]}</p></div>{group.key === 'clients' && canCreate && <Link className="text-link" to="/clients">Client assignments</Link>}</div>
      {group.key === 'mine' && canCreate && <form className="space-create" onSubmit={e => void create(e, 'personal')}>
        <div className="form-group"><label htmlFor="personal-space-name">Personal space name</label><input id="personal-space-name" maxLength={160} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. My training or Program templates" /></div>
        <button className="btn btn-primary" disabled={busy || !name.trim()} type="submit">Create personal space</button>
      </form>}
      {!group.spaces.length && <p className="space-empty">{group.key === 'mine' ? canCreate ? 'No personal spaces yet. Create one for your own work.' : 'Your training space is not available. Contact your coach.' : group.key === 'clients' ? 'No client spaces available. Use Client assignments to see your roster.' : 'No team roster available.'}</p>}
      <div className="space-list">{group.spaces.map(row => {
        const canDelete = row.kind !== 'client' && !rows.some(space => space.parent_workspace_id === row.id) && (isAdmin || row.member_role === 'owner');
        const access = spaceAccessLabel(row.kind, isAdmin ? 'admin' : row.member_role, row.personal_owner_user_id === principal?.userId);
        return <article className="space-row" key={row.id}>
          <div className="space-row-main"><div><h3>{row.name}</h3><p>{access}{row.id === workspaceId && <span> · Current space</span>}</p></div><div className="actions">
            {row.kind === 'organization' && isAdmin && <button className="btn btn-outline" onClick={() => { setWorkspaceId(row.id); navigate('/admin/users'); }}>Manage roster<span className="visually-hidden"> for {row.name}</span></button>}
            <button className="btn btn-outline" onClick={() => { setWorkspaceId(row.id); navigate('/'); }}>{row.kind === 'organization' ? 'Open team workspace' : 'Open space'}<span className="visually-hidden"> {row.name}</span></button>
          </div></div>
          {canDelete && <details className="space-delete"><summary>Delete {row.kind === 'organization' ? 'team' : 'personal space'}</summary><label htmlFor={`delete-${row.id}`}>Type <strong>{row.name}</strong> to confirm</label><div className="space-delete-controls"><input id={`delete-${row.id}`} value={confirm[row.id] ?? ''} onChange={e => setConfirm(current => ({ ...current, [row.id]: e.target.value }))} /><button className="btn btn-danger" disabled={busy || confirm[row.id] !== row.name} onClick={() => void remove(row)}>Delete</button></div></details>}
        </article>;
      })}</div>
      {group.key === 'team' && isAdmin && <details className="team-create"><summary>Create team</summary><form className="space-create" onSubmit={e => void create(e, 'organization')}><div className="form-group"><label htmlFor="team-name">Team name</label><input id="team-name" maxLength={160} value={teamName} onChange={e => setTeamName(e.target.value)} /></div><button className="btn btn-outline" type="submit" disabled={busy || !teamName.trim()}>Create team</button></form></details>}
    </section>)}
  </section>;
}
