import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { libraryApi } from '../api/cloudApi';
import FormModal from '../components/FormModal';
import ConfirmModal from '../components/ConfirmModal';
import Icon from '../components/Icon';
import { useSession } from '../contexts/SessionContext';
import type { Exercise, ExerciseGroup, ExerciseVariation } from '../types/cloud';

export default function WorkspaceLibraryPage() {
  const { workspaceId, principal } = useSession();
  const access = principal?.availableWorkspaces.find((item) => item.workspaceId === workspaceId);
  const canEdit = ['admin', 'owner', 'coach'].includes(access?.role ?? '');
  const [groups, setGroups] = useState<ExerciseGroup[]>([]), [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState(''), [filter, setFilter] = useState(''), [showGroup, setShowGroup] = useState(false), [showExercise, setShowExercise] = useState(false);
  const [groupId, setGroupId] = useState(''), [name, setName] = useState(''), [notes, setNotes] = useState(''), [type, setType] = useState<'strength' | 'cardio'>('strength');
  const [editing, setEditing] = useState<Exercise | null>(null), [deleting, setDeleting] = useState<Exercise | null>(null), [selected, setSelected] = useState<Exercise | null>(null);
  const [variations, setVariations] = useState<ExerciseVariation[]>([]), [variationName, setVariationName] = useState(''), [variationBusy, setVariationBusy] = useState(false);
  const [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!workspaceId) return;
    try { const [g, e] = await Promise.all([libraryApi.groups(workspaceId), libraryApi.exercises(workspaceId, search)]); setGroups(g); setExercises(e); setError(''); }
    catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [workspaceId, search]);
  useEffect(() => { const timeout = setTimeout(() => void load(), 180); return () => clearTimeout(timeout); }, [load]);
  useEffect(() => {
    if (!workspaceId || !selected) return;
    let active = true; setVariations([]);
    libraryApi.variations(workspaceId, selected.id).then((v) => { if (active) setVariations(v); }).catch((e: Error) => setError(e.message));
    return () => { active = false; };
  }, [workspaceId, selected]);
  async function saveExercise(e: FormEvent) {
    e.preventDefault(); if (!workspaceId) return;
    const input = { exerciseGroupId: groupId, name: name.trim(), exerciseType: type, notes };
    if (editing) await libraryApi.updateExercise(workspaceId, editing, input); else await libraryApi.createExercise(workspaceId, input);
    setShowExercise(false); setEditing(null); await load();
  }
  const filtered = exercises.filter((e) => !filter || e.exercise_group_id === filter);
  return <>
    <div className="page-header"><div><h1>Exercise Library</h1><p className="page-subtitle">{access?.workspaceName} · Exercises belong to this space and are shared by its programs.</p></div>{canEdit && <div className="actions"><button className="btn btn-outline" onClick={() => { setName(''); setShowGroup(true); }}>New group</button><button className="btn btn-primary" onClick={() => { setEditing(null); setName(''); setNotes(''); setType('strength'); setGroupId(groups[0]?.id ?? ''); setShowExercise(true); }}><Icon name="plus" />New exercise</button></div>}</div>
    <div className="toolbar"><label className="search-box library-search"><Icon name="search" /><input aria-label="Search exercises" placeholder="Find an exercise" value={search} onChange={(e) => setSearch(e.target.value)} /></label><span className="muted">{filtered.length} exercises</span></div>
    <div className="library-group-tabs" aria-label="Exercise group"><button className={!filter ? 'active' : ''} aria-pressed={!filter} onClick={() => setFilter('')}>All movements</button>{groups.map((g) => <button key={g.id} className={filter === g.id ? 'active' : ''} aria-pressed={filter === g.id} onClick={() => setFilter(g.id)}>{g.name}</button>)}</div>
    {error && <div className="alert alert-danger" role="alert">{error} <button className="inline-link" onClick={() => void load()}>Retry</button></div>}
    {loading ? <div className="empty-state" role="status">Loading exercises…</div> : filtered.length > 0 ? <div className="table-wrap"><table><thead><tr><th>Movement</th><th>Group</th><th>Type</th><th>Programs</th><th><span className="visually-hidden">Actions</span></th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td><strong>{row.name}</strong>{row.notes && <p className="exercise-description">{row.notes}</p>}</td><td>{row.group_name}</td><td><span className="library-type"><Icon name={row.exercise_type === 'strength' ? 'barbell' : 'clock'} />{row.exercise_type}</span></td><td>{row.usage_count ?? 0}</td><td><div className="actions"><button className="quiet-button" onClick={() => { setSelected(row); setVariationName(''); }}>Variations</button>{canEdit && <><button className="quiet-button" onClick={() => { setEditing(row); setName(row.name); setNotes(row.notes ?? ''); setGroupId(row.exercise_group_id); setType(row.exercise_type); setShowExercise(true); }}>Edit</button><button className="quiet-button text-danger" onClick={() => setDeleting(row)}>Delete</button></>}</div></td></tr>)}</tbody></table></div> : <div className="empty-state"><Icon name="barbell" /><h2>No movements in this view</h2><p>{search ? 'Try another search or group.' : 'Add exercises to start building your library.'}</p></div>}
    <FormModal show={showGroup} onHide={() => setShowGroup(false)} title="Create exercise group" onSubmit={async (e) => { e.preventDefault(); if (!workspaceId) return; await libraryApi.createGroup(workspaceId, { name }); setShowGroup(false); await load(); }} submitDisabled={!name.trim()}><div className="form-group"><label>Name</label><input maxLength={160} value={name} onChange={(e) => setName(e.target.value)} /></div></FormModal>
    <FormModal show={showExercise} onHide={() => setShowExercise(false)} title={editing ? 'Edit exercise' : 'Create exercise'} onSubmit={saveExercise} submitDisabled={!name.trim() || !groupId}><div className="form-group"><label>Name</label><input maxLength={160} value={name} onChange={(e) => setName(e.target.value)} /></div><div className="form-group"><label>Group</label><select value={groupId} onChange={(e) => setGroupId(e.target.value)}><option value="">Choose a group</option>{groups.map((g) => <option value={g.id} key={g.id}>{g.name}</option>)}</select></div><div className="form-group"><label>Type</label><select value={type} onChange={(e) => setType(e.target.value as typeof type)}><option value="strength">Strength</option><option value="cardio">Cardio</option></select></div><div className="form-group"><label>Notes</label><textarea maxLength={4000} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div></FormModal>
    <FormModal show={Boolean(selected)} onHide={() => setSelected(null)} title={`${selected?.name ?? 'Exercise'} variations`}>
      <div className="variation-list">{variations.map((v) => <div key={v.id}><strong>{v.name}</strong>{Boolean(v.is_primary) && <span className="badge">Primary</span>}</div>)}{!variations.length && <p className="muted">No variations yet. The base movement is available in workouts.</p>}</div>
      {canEdit && <form onSubmit={async (e) => { e.preventDefault(); if (!workspaceId || !selected || !variationName.trim()) return; setVariationBusy(true); try { await libraryApi.createVariation(workspaceId, selected.id, { name: variationName.trim(), isPrimary: variations.length === 0 }); setVariations(await libraryApi.variations(workspaceId, selected.id)); setVariationName(''); } catch (e) { setError((e as Error).message); } finally { setVariationBusy(false); } }}><label className="form-group">Variation name<input value={variationName} onChange={(e) => setVariationName(e.target.value)} placeholder="e.g. Pause squat" /></label><button className="btn btn-primary" disabled={variationBusy || !variationName.trim()}>{variationBusy ? 'Adding…' : 'Add variation'}</button></form>}
    </FormModal>
    <ConfirmModal show={Boolean(deleting)} onHide={() => setDeleting(null)} title="Delete exercise" message="Delete this exercise and its variations? Exercises already used by a program are protected." onConfirm={async () => { if (workspaceId && deleting) { await libraryApi.removeExercise(workspaceId, deleting.id); await load(); } }} />
  </>;
}
