import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { programsApi } from '../api/cloudApi';
import FormModal from '../components/FormModal';
import Icon from '../components/Icon';
import { useSession } from '../contexts/SessionContext';
import type { Program } from '../types/cloud';

export default function HomePage() {
  const { workspaceId, principal } = useSession();
  const access = principal?.availableWorkspaces.find((item) => item.workspaceId === workspaceId);
  const canPlan = access?.role !== 'client';
  const [rows, setRows] = useState<Program[]>([]), [visibility, setVisibility] = useState<'current' | 'archived'>('current');
  const [show, setShow] = useState(false), [name, setName] = useState(''), [loading, setLoading] = useState(true), [error, setError] = useState(''), [search, setSearch] = useState(''), [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try { setRows(await programsApi.list(workspaceId, visibility)); setError(''); }
    catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [workspaceId, visibility]);
  useEffect(() => { void load(); }, [load]);
  async function create(e: FormEvent) {
    e.preventDefault(); if (!workspaceId) return;
    await programsApi.create(workspaceId, { name: name.trim() }); setName(''); setShow(false); await load();
  }
  async function archive(row: Program) {
    if (!workspaceId) return; setBusy(row.id);
    try { if (row.visibility === 'archived') await programsApi.restore(workspaceId, row.id); else await programsApi.archive(workspaceId, row.id); await load(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }
  const filtered = rows.filter((row) => `${row.name} ${row.owner_name ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  const latest = visibility === 'current' ? rows[0] : undefined;
  return <>
    <div className="page-header"><div><h1>Programs</h1><p className="page-subtitle">A clear plan for the work ahead.</p></div>{canPlan && <button className="btn btn-primary" onClick={() => setShow(true)}><Icon name="plus" />New program</button>}</div>
    <div className="program-layout"><div className="program-main">
      <section className="continuation-panel"><div><h2>{canPlan ? 'Build with intent.\nTrain with a plan.' : 'Your next session\nstarts here.'}</h2><p>{latest ? `Your latest program is ${latest.name}. Pick up where you left off.` : canPlan ? 'Give your training a little structure. Start with a program, then build your sessions.' : 'Your coach’s programs will appear below, ready for you to train.'}</p>{latest && <Link className="btn btn-paper" to={`/programs/${latest.id}`}>{canPlan ? 'Continue programming' : 'Open my program'}<Icon name="arrow" /></Link>}</div><Icon name="barbell" className="continuation-mark" /></section>
      <div className="program-toolbar"><div className="view-tabs" aria-label="Program status"><button className={visibility === 'current' ? 'active' : ''} aria-pressed={visibility === 'current'} onClick={() => setVisibility('current')}>Current <span>{visibility === 'current' ? rows.length : ''}</span></button><button className={visibility === 'archived' ? 'active' : ''} aria-pressed={visibility === 'archived'} onClick={() => setVisibility('archived')}>Archived</button></div><label className="search-box"><Icon name="search" /><input aria-label="Search programs" placeholder="Find a program" value={search} onChange={(e) => setSearch(e.target.value)} /></label></div>
      {error && <div className="alert alert-danger" role="alert">{error} <button className="inline-link" onClick={() => void load()}>Retry</button></div>}
      {loading ? <div className="empty-state" role="status">Loading programs…</div> : !filtered.length ? <div className="empty-state"><Icon name="programs" /><h2>{search ? 'No matching programs' : `No ${visibility} programs yet`}</h2><p>{search ? 'Try another name or clear your search.' : canPlan ? 'Create a program to begin building your training.' : 'Ask your coach to create or copy a program for you.'}</p>{!search && canPlan && visibility === 'current' && <button className="btn btn-primary" onClick={() => setShow(true)}>Create your first program</button>}</div> : <div className="program-list">{filtered.map((row) => <article className="program-row" key={row.id}><span className="program-symbol"><Icon name="programs" /></span><div className="program-row-body"><h2><Link to={`/programs/${row.id}`}>{row.name}</Link></h2><p>{row.owner_name ?? 'Workspace member'}<span>·</span>{row.mesocycle_count ?? 0} {row.mesocycle_count === 1 ? 'mesocycle' : 'mesocycles'}<span>·</span>{row.workout_count ?? 0} {row.workout_count === 1 ? 'workout' : 'workouts'}</p></div><div className="program-row-actions">{canPlan && <button className="quiet-button" disabled={busy === row.id} onClick={() => void archive(row)}>{busy === row.id ? 'Saving…' : row.visibility === 'archived' ? 'Restore' : 'Archive'}</button>}<Link className="icon-button" aria-label={`Open ${row.name}`} to={`/programs/${row.id}`}><Icon name="arrow" /></Link></div></article>)}</div>}
    </div><aside className="program-aside"><section><h2>Your training space</h2><p className="workspace-name">{access?.workspaceName}</p><p>Programs stay with their owner. Exercises are shared across this workspace.</p><Link className="text-link" to="/library">Explore your exercise library <Icon name="arrow" /></Link></section><section className="workflow-guide"><h2>From plan to practice</h2><div><strong>Program</strong><p>The bigger picture for your training.</p></div><div><strong>Mesocycle</strong><p>A block of sessions with a start date.</p></div><div><strong>Workout</strong><p>Your exercises, sets, and actual results.</p></div></section><p className="aside-signoff">Make the plan.<br />Then make it happen.</p></aside></div>
    <FormModal show={show} onHide={() => setShow(false)} title="Create program" onSubmit={create} submitDisabled={!name.trim()}><div className="form-group"><label>Name</label><input autoFocus maxLength={160} placeholder="e.g. Strength foundation" value={name} onChange={(e) => setName(e.target.value)} /></div><p className="muted">Add mesocycles and workouts after you create the program.</p></FormModal>
  </>;
}
