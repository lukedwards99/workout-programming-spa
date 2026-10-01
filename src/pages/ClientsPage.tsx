import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, clientsApi, type ClientAssignment, type WorkspaceMember } from '../api/cloudApi';
import ConfirmModal from '../components/ConfirmModal';
import FormModal from '../components/FormModal';
import { useSession } from '../contexts/SessionContext';

export default function ClientsPage() {
  const { principal, refresh, setWorkspaceId } = useSession();
  const navigate = useNavigate();
  const [rows, setRows] = useState<ClientAssignment[]>([]);
  const [filter, setFilter] = useState('all'), [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [releasing, setReleasing] = useState<ClientAssignment | null>(null);
  const [assigning, setAssigning] = useState<ClientAssignment | null>(null), [coaches, setCoaches] = useState<WorkspaceMember[]>([]), [coachId, setCoachId] = useState('');
  const staff = principal?.platformRoles.includes('admin') || principal?.memberships.some(m => m.kind === 'organization' && ['owner', 'coach'].includes(m.role));
  const load = useCallback(async () => {
    if (!staff) { setLoading(false); return; }
    try { setRows(await clientsApi.list()); setError(''); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [staff]);
  useEffect(() => { void load(); }, [load]);
  if (!staff) return <div className="alert alert-danger" role="alert">Client assignments are available to coaches, owners, and administrators.</div>;
  const visible = rows.filter(row => (filter === 'all' || (filter === 'mine' ? row.coach_user_id === principal?.userId : !row.coach_user_id))
    && `${row.display_name} ${row.email_display} ${row.coach_name ?? ''} ${row.organization_name}`.toLowerCase().includes(search.toLowerCase()));
  async function claim(row: ClientAssignment, target?: string) {
    setBusy(true); setNotice('');
    try { await clientsApi.claim(row.client_user_id, target); await refresh(); await load(); setAssigning(null); setNotice(`${row.display_name} has been assigned. Their space is ready to open.`); }
    catch (e) { await load(); if (target) throw e; setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function chooseCoach(row: ClientAssignment) {
    setBusy(true);
    try { const members = await adminApi.members(row.organization_id); const active = members.filter(m => m.status === 'active' && m.user_status === 'active' && ['owner', 'coach'].includes(m.role)); setCoaches(active); setCoachId(active[0]?.user_id ?? ''); setAssigning(row); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <>
    <div className="page-header"><div><h1>Client assignments</h1><p className="page-subtitle">One client, one space, one assigned coach. Claim an unassigned client to start programming.</p></div></div>
    <p className="assignment-help">Release returns a client to the unassigned list and removes your access. Their programs, results, and exercise library stay in their space. Organization owners and admins can release another coach’s assignment.</p>
    {error && <div className="alert alert-danger" role="alert">{error} <button className="inline-link" onClick={() => void load()}>Refresh</button></div>}
    {notice && <div className="alert alert-success" role="status">{notice}</div>}
    <div className="assignment-toolbar">
      <div className="actions" role="group" aria-label="Assignment filter">{[['all', 'All clients'], ['mine', 'My clients'], ['unassigned', 'Unassigned']].map(([value, label]) => <button key={value} className={`btn btn-sm ${filter === value ? 'btn-primary' : 'btn-outline'}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
      <input className="form-control" aria-label="Search clients or coaches" placeholder="Search clients or coaches" value={search} onChange={e => setSearch(e.target.value)} />
    </div>
    {loading ? <div className="empty-state" role="status">Loading assignments…</div> : !visible.length ? <div className="empty-state"><h2>{rows.length ? 'No matching clients' : 'No active clients yet'}</h2><p>{rows.length ? 'Try another filter or search.' : 'Add a client to the organization roster to create their space automatically.'}</p></div> : <div className="table-wrap"><table className="assignment-table"><thead><tr><th scope="col">Client</th><th scope="col">Assigned coach</th><th scope="col">Client space</th><th scope="col">Actions</th></tr></thead><tbody>{visible.map(row => {
      const mine = row.coach_user_id === principal?.userId;
      const canClaim = principal?.memberships.some(m => m.workspaceId === row.organization_id && ['owner', 'coach'].includes(m.role));
      return <tr key={row.client_user_id}><td data-label="Client"><strong>{row.display_name}</strong><div className="muted">{row.email_display}</div><div className="muted">{row.organization_name}</div></td>
        <td data-label="Assigned coach">{row.coach_name ? <><strong>{row.coach_name}</strong>{mine && <div className="muted">Assigned to you</div>}</> : <span className="badge">Unassigned</span>}</td>
        <td data-label="Client space"><span>{row.space_name}</span><div className="muted">{row.program_count} {row.program_count === 1 ? 'program' : 'programs'} · private exercise library</div></td>
        <td data-label="Actions"><div className="actions">{Boolean(row.can_open) && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => { setWorkspaceId(row.space_id); navigate('/'); }}>Open space<span className="visually-hidden"> for {row.display_name}</span></button>}
          {!row.coach_user_id && canClaim && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void claim(row)}>Claim client<span className="visually-hidden"> {row.display_name}</span></button>}
          {!row.coach_user_id && Boolean(row.can_force_release) && <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => void chooseCoach(row)}>Assign coach<span className="visually-hidden"> for {row.display_name}</span></button>}
          {row.coach_user_id && (mine || Boolean(row.can_force_release)) && <button className={`btn btn-sm ${mine ? 'btn-outline' : 'btn-danger'}`} disabled={busy} onClick={() => setReleasing(row)}>{mine ? 'Release client' : 'Force release'}<span className="visually-hidden"> {row.display_name}</span></button>}
          {row.coach_user_id && !mine && !row.can_force_release && <span className="muted">Managed by {row.coach_name}</span>}
        </div></td></tr>;
    })}</tbody></table></div>}
    <ConfirmModal show={Boolean(releasing)} onHide={() => setReleasing(null)} title={releasing?.coach_user_id === principal?.userId ? 'Release client' : 'Force release client'} message={`Release ${releasing?.display_name ?? 'this client'} from ${releasing?.coach_name ?? 'their coach'}? The client keeps their space and all training data. The coach loses access immediately.`} confirmLabel="Release" onConfirm={async () => {
      if (!releasing?.relationship_id) return;
      await clientsApi.release(releasing.client_user_id, releasing.relationship_id); setNotice(`${releasing.display_name} is now unassigned.`); setReleasing(null); await refresh(); await load();
    }} />
    <FormModal show={Boolean(assigning)} onHide={() => setAssigning(null)} title={`Assign a coach to ${assigning?.display_name ?? 'client'}`} submitLabel="Assign coach" submitDisabled={!coachId || busy} onSubmit={async e => { e.preventDefault(); if (assigning) await claim(assigning, coachId); }}>
      <div className="form-group"><label htmlFor="assignment-coach">Coach</label><select id="assignment-coach" value={coachId} onChange={e => setCoachId(e.target.value)}>{coaches.map(coach => <option key={coach.user_id} value={coach.user_id}>{coach.display_name}</option>)}</select></div>
    </FormModal>
  </>;
}
