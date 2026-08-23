import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { programsApi } from '../api/cloudApi';
import { ApiClientError } from '../api/http';
import FormModal from '../components/FormModal';
import { useSession } from '../contexts/SessionContext';
import type { Program } from '../types/cloud';

export default function HomePage() {
  const { workspaceId, principal } = useSession();
  const membership = principal?.memberships.find((item) => item.workspaceId === workspaceId);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [visibility, setVisibility] = useState<'current' | 'archived'>('current');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'personal' | 'template'>('personal');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true); setError(null);
    try { setPrograms(await programsApi.list(workspaceId, visibility)); }
    catch (reason) { setError((reason as Error).message); }
    finally { setLoading(false); }
  }, [workspaceId, visibility]);
  useEffect(() => { void load(); }, [load]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!workspaceId) return;
    try {
      await programsApi.create(workspaceId, { name, kind });
      setName(''); setShowCreate(false); await load();
    } catch (reason) { setError((reason as Error).message); }
  };

  const toggleArchive = async (row: Program) => {
    if (!workspaceId) return;
    try {
      if (row.visibility === 'archived') await programsApi.restore(workspaceId, row.id);
      else await programsApi.archive(workspaceId, row.id);
      await load();
    } catch (reason) {
      const message = reason instanceof ApiClientError && reason.status === 409 ? `Conflict: ${reason.message}` : (reason as Error).message;
      setError(message);
    }
  };

  return <>
    <div className="page-header">
      <div><h1>Programs</h1><p className="page-subtitle">Templates, personal plans, and independent client assignments in this workspace.</p></div>
      {membership?.role !== 'client' && <button className="btn btn-primary" onClick={() => setShowCreate(true)}>New program</button>}
    </div>
    <div className="toolbar">
      <button className={`btn btn-sm ${visibility === 'current' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setVisibility('current')}>Current</button>
      <button className={`btn btn-sm ${visibility === 'archived' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setVisibility('archived')}>Archived</button>
    </div>
    {error && <div className="alert alert-danger">{error} <button className="inline-link" onClick={() => void load()}>Retry</button></div>}
    {loading ? <div className="empty-state">Loading programs…</div> : programs.length === 0 ? <div className="empty-state"><h2>No {visibility} programs</h2><p>Create a personal plan or reusable coaching template.</p></div> : (
      <div className="row g-3">
        {programs.map((row) => <div className="col-12 col-md-6 col-xl-4" key={row.id}><article className="card program-card">
          <div className="card-title-row"><h2><Link to={`/programs/${row.id}`}>{row.name}</Link></h2><span className="badge">{row.kind}</span></div>
          <p className="muted">{row.client_name ? `Assigned to ${row.client_name}` : `Owned by ${row.owner_name ?? 'workspace member'}`}</p>
          <div className="badge-row"><span className={`status status-${row.status}`}>{row.status}</span><span className="muted">revision {row.revision}</span></div>
          {membership?.role !== 'client' && <button className="btn btn-outline btn-sm" onClick={() => void toggleArchive(row)}>{row.visibility === 'archived' ? 'Restore' : 'Archive'}</button>}
        </article></div>)}
      </div>
    )}
    <FormModal show={showCreate} onHide={() => setShowCreate(false)} title="Create program" onSubmit={submit} submitDisabled={!name.trim()}>
      <div className="form-group"><label>Name</label><input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></div>
      <div className="form-group"><label>Kind</label><select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="personal">Personal</option>{membership?.role !== 'client' && <option value="template">Template</option>}</select></div>
    </FormModal>
  </>;
}
