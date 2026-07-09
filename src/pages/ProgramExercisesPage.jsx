import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { programsApi } from '../api/programsApi';
import { exerciseGroupsApi } from '../api/exerciseGroupsApi';
import { exercisesApi } from '../api/exercisesApi';
import { exerciseVariationsApi } from '../api/exerciseVariationsApi';
import { copyApi } from '../api/copyApi';
import { FormModal, ConfirmModal } from '../components';

export default function ProgramExercisesPage() {
  const { programId } = useParams();
  const pid = Number(programId);
  const [program, setProgram] = useState(null);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [alert, setAlert] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [varInputs, setVarInputs] = useState({});

  // Group modal
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', notes: '' });
  const [editingGroupId, setEditingGroupId] = useState(null);

  // Exercise modal
  const [showExModal, setShowExModal] = useState(false);
  const [exForm, setExForm] = useState({ groupId: '', name: '', tutorialUrl: '', notes: '' });
  const [editingExId, setEditingExId] = useState(null);

  // Copy modal
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copySourceProgramId, setCopySourceProgramId] = useState('');
  const [copySourceData, setCopySourceData] = useState([]);
  const [selectedExIds, setSelectedExIds] = useState(new Set());

  // Delete confirmations
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(() => {
    const p = programsApi.get(pid);
    if (!p) return;
    setProgram(p);
    setGroups(exerciseGroupsApi.list(pid));
    setExercises(exercisesApi.list(pid, selectedGroup));
  }, [pid, selectedGroup]);

  useEffect(() => { load(); }, [load]);

  if (!program) return <div className="empty-state"><p>Program not found.</p></div>;

  const flash = (type, msg) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 4000);
  };

  // ── Groups ──
  const handleGroupSubmit = (e) => {
    e.preventDefault();
    if (editingGroupId) {
      exerciseGroupsApi.update(editingGroupId, groupForm);
      flash('success', `"${groupForm.name}" updated.`);
    } else {
      exerciseGroupsApi.create({ programId: pid, name: groupForm.name, notes: groupForm.notes });
      flash('success', `"${groupForm.name}" created.`);
    }
    setShowGroupModal(false);
    load();
  };

  const openAddGroup = () => {
    setEditingGroupId(null);
    setGroupForm({ name: '', notes: '' });
    setShowGroupModal(true);
  };

  const openEditGroup = (g) => {
    setEditingGroupId(g.id);
    setGroupForm({ name: g.name, notes: g.notes || '' });
    setShowGroupModal(true);
  };

  const deleteGroup = (id) => {
    const g = groups.find((x) => x.id === id);
    setDeleteTarget({ type: 'group', id, name: g.name });
    setShowDeleteConfirm(true);
  };

  // ── Exercises ──
  const handleExSubmit = (e) => {
    e.preventDefault();
    if (editingExId) {
      exercisesApi.update(editingExId, exForm);
      flash('success', `"${exForm.name}" updated.`);
    } else {
      exercisesApi.create(exForm);
      flash('success', `"${exForm.name}" created.`);
    }
    setShowExModal(false);
    load();
  };

  const openAddEx = () => {
    setEditingExId(null);
    setExForm({ groupId: selectedGroup || (groups[0]?.id || ''), name: '', tutorialUrl: '', notes: '' });
    setShowExModal(true);
  };

  const openEditEx = (ex) => {
    setEditingExId(ex.id);
    setExForm({ groupId: ex.exercise_group_id, name: ex.name, tutorialUrl: ex.tutorial_url || '', notes: ex.notes || '' });
    setShowExModal(true);
  };

  const deleteEx = (id) => {
    const ex = exercises.find((x) => x.id === id);
    setDeleteTarget({ type: 'exercise', id, name: ex.name });
    setShowDeleteConfirm(true);
  };

  // ── Variations ──
  const addVariation = (exerciseId) => {
    const name = (varInputs[exerciseId] || '').trim();
    if (!name) return;
    const existing = exerciseVariationsApi.list(exerciseId);
    exerciseVariationsApi.create({ exerciseId, name, isPrimary: existing.length === 0 });
    flash('success', `Variation "${name}" added.`);
    setVarInputs({ ...varInputs, [exerciseId]: '' });
    load();
  };

  const deleteVariation = (id) => {
    const v = exerciseVariationsApi.get(id);
    setDeleteTarget({ type: 'variation', id, name: v.name });
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    switch (deleteTarget.type) {
      case 'group':
        exerciseGroupsApi.delete(deleteTarget.id);
        if (selectedGroup === deleteTarget.id) setSelectedGroup(null);
        break;
      case 'exercise':
        exercisesApi.delete(deleteTarget.id);
        break;
      case 'variation':
        exerciseVariationsApi.delete(deleteTarget.id);
        break;
    }
    flash('success', `"${deleteTarget.name}" deleted.`);
    load();
  };

  const getDeleteMessage = () => {
    if (!deleteTarget) return '';
    switch (deleteTarget.type) {
      case 'group': return `Delete "${deleteTarget.name}"? All exercises in this group will also be deleted.`;
      case 'exercise': return `Delete "${deleteTarget.name}"?`;
      case 'variation': return `Delete variation "${deleteTarget.name}"?`;
      default: return '';
    }
  };

  // ── Copy ──
  const openCopyModal = () => {
    setShowCopyModal(true);
    setCopySourceProgramId('');
    setCopySourceData([]);
    setSelectedExIds(new Set());
  };

  const toggleExSelect = (exId) => {
    const next = new Set(selectedExIds);
    if (next.has(exId)) next.delete(exId); else next.add(exId);
    setSelectedExIds(next);
  };

  const handleCopy = (e) => {
    e.preventDefault();
    if (selectedExIds.size === 0) return;
    copyApi.copyExercises(Number(copySourceProgramId), pid, [...selectedExIds]);
    flash('success', `Copied ${selectedExIds.size} exercise(s).`);
    setShowCopyModal(false);
    load();
  };

  const allPrograms = programsApi.list().filter((p) => p.id !== pid);

  let filtered = exercises;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter((e) => e.name.toLowerCase().includes(q));
  }

  return (
    <>
      <div className="page-header">
        <h1>Exercise Library</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {allPrograms.length > 0 && (
            <button className="btn btn-outline" onClick={openCopyModal}>Copy from Program</button>
          )}
          <button className="btn btn-primary" onClick={openAddEx}>+ Add Exercise</button>
        </div>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      <div className="row">
        <div className="col-12 col-md-3 mb-3 mb-md-0">
          <div
            className={`group-item ${selectedGroup === null ? 'active' : ''}`}
            onClick={() => setSelectedGroup(null)}
          >
            <span>All Exercises</span>
            <span className="group-count">{exercisesApi.list(pid, null).length}</span>
          </div>
          {groups.map((g) => (
            <div
              key={g.id}
              className={`group-item ${selectedGroup === g.id ? 'active' : ''}`}
              onClick={() => setSelectedGroup(g.id)}
            >
              <span>{g.name}</span>
              <span className="group-count">{g.exercise_count}</span>
            </div>
          ))}
          <button className="btn btn-outline btn-sm" onClick={openAddGroup} style={{ marginTop: 12, width: '100%' }}>
            + New Group
          </button>
        </div>

        <div className="col-12 col-md-9">
          <input
            className="search-input"
            placeholder="Search exercises..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {filtered.length === 0 ? (
            <div className="empty-state"><p>No exercises found.</p></div>
          ) : (
            filtered.map((ex) => {
              const variations = exerciseVariationsApi.list(ex.id) || [];
              const isOpen = expandedId === ex.id;
              return (
                <div className="ex-item" key={ex.id}>
                  <div className="ex-item-header" onClick={() => setExpandedId(isOpen ? null : ex.id)}>
                    <div>
                      <h4>{ex.name}</h4>
                      <div className="ex-item-meta">
                        {groups.find((g) => g.id === ex.exercise_group_id)?.name || 'Unknown'} &middot; {variations.length} variation{variations.length !== 1 ? 's' : ''}
                        {ex.notes && <> &middot; {ex.notes}</>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); openEditEx(ex); }}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); deleteEx(ex.id); }}>Del</button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="ex-item-detail">
                      {ex.tutorial_url && (
                        <div style={{ fontSize: 12, marginBottom: 8 }}>
                          <a href={ex.tutorial_url} target="_blank" rel="noreferrer">{ex.tutorial_url}</a>
                        </div>
                      )}
                      <strong style={{ fontSize: 12, color: 'var(--text-muted)' }}>Variations</strong>
                      {variations.map((v) => (
                        <div className="var-item" key={v.id}>
                          <span>
                            {v.name}{v.is_primary ? <span className="var-primary">primary</span> : ''}
                          </span>
                          <button className="btn btn-xs btn-danger" onClick={() => deleteVariation(v.id)}>&times;</button>
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <input
                          style={{ flex: 1, padding: '5px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', fontSize: 12 }}
                          placeholder="Variation name..."
                          value={varInputs[ex.id] || ''}
                          onChange={(e) => setVarInputs({ ...varInputs, [ex.id]: e.target.value })}
                        />
                        <button className="btn btn-primary btn-xs" onClick={() => addVariation(ex.id)}>+</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Group Modal */}
      <FormModal show={showGroupModal} onHide={() => setShowGroupModal(false)} title={editingGroupId ? 'Edit Group' : 'Add Group'} onSubmit={handleGroupSubmit}>
        <div className="form-group">
          <label>Name</label>
          <input value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} placeholder="e.g. Chest" required autoFocus />
        </div>
        <div className="form-group">
          <label>Notes</label>
          <textarea value={groupForm.notes} onChange={(e) => setGroupForm({ ...groupForm, notes: e.target.value })} />
        </div>
      </FormModal>

      {/* Exercise Modal */}
      <FormModal show={showExModal} onHide={() => setShowExModal(false)} title={editingExId ? 'Edit Exercise' : 'Add Exercise'} onSubmit={handleExSubmit}>
        <div className="form-group">
          <label>Muscle Group</label>
          <select value={exForm.groupId} onChange={(e) => setExForm({ ...exForm, groupId: Number(e.target.value) })} required>
            <option value="">-- Select --</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Exercise Name</label>
          <input value={exForm.name} onChange={(e) => setExForm({ ...exForm, name: e.target.value })} placeholder="e.g. Barbell Bench Press" required autoFocus />
        </div>
        <div className="form-group">
          <label>Tutorial URL (optional)</label>
          <input value={exForm.tutorialUrl} onChange={(e) => setExForm({ ...exForm, tutorialUrl: e.target.value })} placeholder="https://..." />
        </div>
        <div className="form-group">
          <label>Notes</label>
          <textarea value={exForm.notes} onChange={(e) => setExForm({ ...exForm, notes: e.target.value })} placeholder="Form cues, tips..." />
        </div>
      </FormModal>

      {/* Copy Modal */}
      <FormModal show={showCopyModal} onHide={() => setShowCopyModal(false)} title="Copy Exercises from Another Program" onSubmit={handleCopy} submitLabel={`Copy Selected (${selectedExIds.size})`}>
        <div className="form-group">
          <label>Source Program</label>
          <select value={copySourceProgramId} onChange={(e) => {
            const val = e.target.value;
            setCopySourceProgramId(val);
            if (val) {
              setCopySourceData(copyApi.getSourceExercises(Number(val)));
              setSelectedExIds(new Set());
            } else {
              setCopySourceData([]);
              setSelectedExIds(new Set());
            }
          }}>
            <option value="">-- Select program --</option>
            {allPrograms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {copySourceData.length > 0 && (
          <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
            {copySourceData.map(({ group, exercises }) => (
              <div key={group.id} style={{ marginBottom: 12 }}>
                <strong style={{ fontSize: 13, color: 'var(--text-muted)' }}>{group.name}</strong>
                {exercises.map((ex) => (
                  <label key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 14, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedExIds.has(ex.id)}
                      onChange={() => toggleExSelect(ex.id)}
                    />
                    {ex.name}
                    {ex.notes && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>({ex.notes})</span>}
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}
      </FormModal>

      <ConfirmModal
        show={showDeleteConfirm}
        onHide={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title={`Delete ${deleteTarget?.type === 'variation' ? 'Variation' : deleteTarget?.type === 'exercise' ? 'Exercise' : 'Group'}`}
        message={getDeleteMessage()}
      />
    </>
  );
}
