import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { libraryApi } from '../api/cloudApi';
import FormModal from '../components/FormModal';
import ConfirmModal from '../components/ConfirmModal';
import { useSession } from '../contexts/SessionContext';
import type { Exercise, ExerciseGroup } from '../types/cloud';

export default function WorkspaceLibraryPage() {
  const { workspaceId, principal } = useSession();
  const membership = principal?.memberships.find((item) => item.workspaceId === workspaceId);
  const canEdit = membership?.role === 'owner' || membership?.role === 'coach';
  const [groups, setGroups] = useState<ExerciseGroup[]>([]); const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState(''); const [showGroup, setShowGroup] = useState(false); const [showExercise, setShowExercise] = useState(false);
  const [groupId, setGroupId] = useState(''); const [name, setName] = useState(''); const [type, setType] = useState<'strength' | 'cardio'>('strength');
  const [deleting, setDeleting] = useState<Exercise | null>(null); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { if (!workspaceId) return; try { const [nextGroups, nextExercises] = await Promise.all([libraryApi.groups(workspaceId), libraryApi.exercises(workspaceId, search)]); setGroups(nextGroups); setExercises(nextExercises); setError(null); } catch (reason) { setError((reason as Error).message); } }, [workspaceId, search]);
  useEffect(() => { const timeout = setTimeout(() => void load(), 180); return () => clearTimeout(timeout); }, [load]);
  const addGroup = async (event: FormEvent) => { event.preventDefault(); if (!workspaceId) return; try { await libraryApi.createGroup(workspaceId, { name }); setName(''); setShowGroup(false); await load(); } catch (reason) { setError((reason as Error).message); } };
  const addExercise = async (event: FormEvent) => { event.preventDefault(); if (!workspaceId) return; try { await libraryApi.createExercise(workspaceId, { exerciseGroupId: groupId, name, exerciseType: type }); setName(''); setShowExercise(false); await load(); } catch (reason) { setError((reason as Error).message); } };
  return <>
    <div className="page-header"><div><h1>Exercise Library</h1><p className="page-subtitle">Shared across every program in this workspace.</p></div>{canEdit && <div className="actions"><button className="btn btn-outline" onClick={() => { setName(''); setShowGroup(true); }}>New group</button><button className="btn btn-primary" onClick={() => { setName(''); setGroupId(groups[0]?.id ?? ''); setShowExercise(true); }}>New exercise</button></div>}</div>
    <div className="toolbar"><input className="search-input" aria-label="Search exercises" placeholder="Search exercises…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
    {error && <div className="alert alert-danger">{error} <button className="inline-link" onClick={() => void load()}>Retry</button></div>}
    <div className="table-wrap"><table><thead><tr><th>Exercise</th><th>Group</th><th>Type</th><th>In use</th>{canEdit && <th />}</tr></thead><tbody>{exercises.map((row) => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.group_name}</td><td><span className="badge">{row.exercise_type}</span></td><td>{row.usage_count ?? 0} programs</td>{canEdit && <td><button className="btn btn-danger btn-xs" onClick={() => setDeleting(row)}>Delete</button></td>}</tr>)}</tbody></table></div>
    {exercises.length === 0 && <div className="empty-state"><p>No exercises match this view.</p></div>}
    <FormModal show={showGroup} onHide={() => setShowGroup(false)} title="Create exercise group" onSubmit={addGroup} submitDisabled={!name.trim()}><div className="form-group"><label>Name</label><input value={name} onChange={(event) => setName(event.target.value)} /></div></FormModal>
    <FormModal show={showExercise} onHide={() => setShowExercise(false)} title="Create exercise" onSubmit={addExercise} submitDisabled={!name.trim() || !groupId}><div className="form-group"><label>Name</label><input value={name} onChange={(event) => setName(event.target.value)} /></div><div className="form-group"><label>Group</label><select value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="">Choose…</option>{groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select></div><div className="form-group"><label>Type</label><select value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="strength">Strength</option><option value="cardio">Cardio</option></select></div></FormModal>
    <ConfirmModal show={Boolean(deleting)} onHide={() => setDeleting(null)} title="Delete exercise" message="Delete this exercise and its variations? Exercises already used by a program are protected." onConfirm={async () => { if (workspaceId && deleting) { await libraryApi.removeExercise(workspaceId, deleting.id); await load(); } }} />
  </>;
}
