import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { programsApi } from '../api/cloudApi';
import FormModal from '../components/FormModal';
import { useSession } from '../contexts/SessionContext';
import type { Program } from '../types/cloud';

export default function HomePage() {
  const { workspaceId, principal } = useSession(); const access = principal?.availableWorkspaces.find((item) => item.workspaceId === workspaceId); const canPlan = access?.role !== 'client';
  const [rows, setRows] = useState<Program[]>([]), [visibility, setVisibility] = useState<'current'|'archived'>('current'), [show, setShow] = useState(false), [name, setName] = useState(''), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const load = useCallback(async () => { if (!workspaceId) return; setLoading(true); try { setRows(await programsApi.list(workspaceId, visibility)); setError(''); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } }, [workspaceId, visibility]);
  useEffect(() => { void load(); }, [load]);
  async function create(event: FormEvent) { event.preventDefault(); if (!workspaceId) return; try { await programsApi.create(workspaceId, { name }); setName(''); setShow(false); await load(); } catch (e) { setError((e as Error).message); } }
  return <>
    <div className="page-header"><div><h1>Programs</h1><p className="page-subtitle">Independent programs you can edit, archive, and copy between workspace members.</p></div>{canPlan && <button className="btn btn-primary" onClick={() => setShow(true)}>New program</button>}</div>
    <div className="toolbar"><button className={`btn btn-sm ${visibility === 'current' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setVisibility('current')}>Current</button><button className={`btn btn-sm ${visibility === 'archived' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setVisibility('archived')}>Archived</button></div>
    {error && <div className="alert alert-danger">{error} <button className="inline-link" onClick={() => void load()}>Retry</button></div>}
    {loading ? <div className="empty-state">Loading programs…</div> : !rows.length ? <div className="empty-state"><h2>No {visibility} programs</h2><p>Create a program or copy one from a client.</p></div> : <div className="row g-3">{rows.map((row) => <div className="col-12 col-md-6 col-xl-4" key={row.id}><article className="card program-card"><div className="card-title-row"><h2><Link to={`/programs/${row.id}`}>{row.name}</Link></h2><span className="badge">{row.visibility}</span></div><p className="muted">Owned by {row.owner_name ?? 'workspace member'}</p><div className="badge-row"><span className="muted">revision {row.revision}</span></div>{canPlan && <button className="btn btn-outline btn-sm" onClick={async () => { if (!workspaceId) return; row.visibility === 'archived' ? await programsApi.restore(workspaceId, row.id) : await programsApi.archive(workspaceId, row.id); await load(); }}>{row.visibility === 'archived' ? 'Restore' : 'Archive'}</button>}</article></div>)}</div>}
    <FormModal show={show} onHide={() => setShow(false)} title="Create program" onSubmit={create} submitDisabled={!name.trim()}><div className="form-group"><label>Name</label><input autoFocus value={name} onChange={(e) => setName(e.target.value)} /></div></FormModal>
  </>;
}
