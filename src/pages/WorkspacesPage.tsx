import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { adminApi, type WorkspaceRow } from '../api/cloudApi';
import { ApiClientError } from '../api/http';
import { useSession } from '../contexts/SessionContext';

export default function WorkspacesPage() {
  const navigate = useNavigate();
  const { principal, workspaceId, setWorkspaceId, refresh } = useSession();
  const [rows, setRows] = useState<WorkspaceRow[]>([]); const [name, setName] = useState(''); const [kind,setKind] = useState<'personal'|'organization'>('personal'); const [confirm, setConfirm] = useState<Record<string, string>>({}); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const canCreate = principal?.platformRoles.includes('admin') || principal?.memberships.some((item) => item.status === 'active' && ['owner', 'coach'].includes(item.role));
  async function load() { try { setRows(await adminApi.workspaces()); setError(''); } catch (e) { setError(e instanceof ApiClientError ? e.message : 'Unable to load workspaces.'); } }
  useEffect(() => { void load(); }, []);
  async function create() { if (!name.trim()) return; setBusy(true); try { const row = await adminApi.createWorkspace(name.trim(),kind); localStorage.setItem('liftlog-workspace-id', row.id); await refresh(); await load(); setName(''); } catch (e) { setError(e instanceof ApiClientError ? e.message : 'Unable to create workspace.'); } finally { setBusy(false); } }
  async function remove(row: WorkspaceRow) { setBusy(true); try { await adminApi.deleteWorkspace(row.id, confirm[row.id] ?? ''); if (workspaceId === row.id) localStorage.removeItem('liftlog-workspace-id'); await refresh(); await load(); } catch (e) { setError(e instanceof ApiClientError ? e.message : 'Unable to delete workspace.'); } finally { setBusy(false); } }
  return <section className="page-section">
    <div className="page-header"><div><h1>Spaces</h1><p>Each client has one space. Create personal spaces for your own training or coaching work.</p></div></div>
    {error && <div className="alert alert-danger">{error}</div>}
    {canCreate && <div className="card p-3 mb-4"><h2 className="h5">New space</h2><div className="d-flex gap-2 space-create"><input className="form-control" value={name} onChange={(e) => setName(e.target.value)} placeholder="Space name" aria-label="Space name" />{principal?.platformRoles.includes('admin') && <select aria-label="Space type" value={kind} onChange={e => setKind(e.target.value as typeof kind)}><option value="personal">Personal space</option><option value="organization">Organization roster</option></select>}<button className="btn btn-primary" disabled={busy || !name.trim()} onClick={() => void create()}>Create</button></div></div>}
    <div className="stack-list">{rows.map((row) => { const canDelete = row.kind !== 'client' && !rows.some(space => space.parent_workspace_id === row.id) && (principal?.platformRoles.includes('admin') || row.member_role === 'owner'); return <article className="card p-3" key={row.id}>
      <div className="d-flex justify-content-between gap-3 align-items-start"><div><h2 className="h5 mb-1">{row.name}</h2><p className="muted mb-0">{row.kind === 'client' ? 'Client space' : row.kind === 'personal' ? 'Personal space' : 'Organization roster'} · {row.member_role ?? 'platform admin access'}{row.id === workspaceId ? ' · selected' : ''}</p></div><button className="btn btn-outline-primary" onClick={() => { setWorkspaceId(row.id); navigate('/'); }}>Open</button></div>
      {canDelete && <div className="mt-3 border-top pt-3"><label className="form-label">Type <strong>{row.name}</strong> to delete</label><div className="d-flex gap-2"><input className="form-control" value={confirm[row.id] ?? ''} onChange={(e) => setConfirm((current) => ({ ...current, [row.id]: e.target.value }))} /><button className="btn btn-danger" disabled={busy || confirm[row.id] !== row.name} onClick={() => void remove(row)}>Delete</button></div></div>}
    </article>; })}</div>
    {!rows.length && <div className="empty-state"><h2>No workspaces yet</h2><p>Create one to start programming.</p></div>}
  </section>;
}
