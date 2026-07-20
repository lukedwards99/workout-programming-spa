import { useState, useEffect, useCallback, useRef, type ChangeEvent, type FormEvent, type MouseEvent } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import type { Program, Mesocycle, Workout, MesocycleTrainingSummary, CardioSession, CardioTrainingSummary } from '../types/domain';
import type { CreateCardioSessionInput } from '../types/api';
import { activateProgram, deactivateProgram } from '../db/databaseService';
import { programsApi } from '../api/programsApi';
import { mesocyclesApi } from '../api/mesocyclesApi';
import { workoutsApi } from '../api/workoutsApi';
import { cardioSessionsApi } from '../api/cardioSessionsApi';
import { summaryApi } from '../api/summaryApi';
import { exportMesocycleWorkbook, replaceMesocycleFromWorkbook, validateMesocycleWorkbook, type ImportedMesocycleWorkbook } from '../api/mesocycleSpreadsheetApi';
import { FormModal, ConfirmModal, WorkoutEditModal } from '../components';
import WorkoutGeneratorModal from '../components/workout-generator/WorkoutGeneratorModal';
import SummaryStatGrid, { buildStatItems } from '../components/summary/SummaryStatGrid';
import SummaryBreakdownTables from '../components/summary/SummaryBreakdownTables';
import SummarySetTypeFilterControls, { useSummarySetTypeFilter } from '../components/summary/SummarySetTypeFilter';
import { formatCount } from '../components/summary/formatSummary';
import CardioSummary from '../components/summary/CardioSummary';

interface Alert {
  type: string;
  msg: string;
}

interface PendingDelete {
  id: number;
  name: string;
}

export default function MesocyclePage() {
  const { programId, mesocycleId } = useParams<{ programId: string; mesocycleId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawView = searchParams.get('view');
  const view = rawView === 'summary' || rawView === 'cardio' ? rawView : 'schedule';
  const [mesocycle, setMesocycle] = useState<Mesocycle | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [cardioSessions, setCardioSessions] = useState<CardioSession[]>([]);
  const [program, setProgram] = useState<Program | null>(null);
  const [summaryData, setSummaryData] = useState<MesocycleTrainingSummary | null>(null);
  const [cardioSummaryData, setCardioSummaryData] = useState<CardioTrainingSummary | null>(null);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [addDay, setAddDay] = useState(0);
  const [woName, setWoName] = useState('');
  const [sessionType, setSessionType] = useState<'workout' | 'cardio'>('workout');
  const [cardioForm, setCardioForm] = useState<Omit<CreateCardioSessionInput, 'mesocycleId'>>({ name: '', modality: '', dayOffset: 0, plannedDurationMinutes: 30, plannedDistance: null, targetRpe: 5, completedDurationMinutes: null, completedDistance: null, actualRpe: null, notes: '' });
  const [editingCardio, setEditingCardio] = useState<CardioSession | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Edit state ──
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
  const [editName, setEditName] = useState('');
  const [editDay, setEditDay] = useState(0);
  const [editBusy, setEditBusy] = useState(false);

  // ── Generator state ──
  const [showGenerator, setShowGenerator] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<ImportedMesocycleWorkbook | null>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const { selectedSetTypes } = useSummarySetTypeFilter();

  const load = useCallback(() => {
    const m = mesocyclesApi.get(Number(mesocycleId));
    if (!m) {
      setError('Mesocycle not found in this program.');
      return;
    }
    setMesocycle(m);
    setWorkouts(workoutsApi.list(m.id));
    setCardioSessions(cardioSessionsApi.list(m.id));
    setError(null);
  }, [mesocycleId]);

  const loadSummary = useCallback(() => {
    const data = summaryApi.getMesocycleSummary(Number(mesocycleId), selectedSetTypes);
    setSummaryData(data);
  }, [mesocycleId, selectedSetTypes]);

  const loadCardioSummary = useCallback(() => {
    setCardioSummaryData(summaryApi.getMesocycleCardioSummary(Number(mesocycleId)));
  }, [mesocycleId]);

  useEffect(() => {
    const pid = Number(programId);
    const p = programsApi.get(pid);
    if (!p) {
      setError('Program not found.');
      return;
    }
    setProgram(p);
    activateProgram(pid)
      .then(() => {
        load();
        if (view === 'summary') loadSummary();
        if (view === 'cardio') loadCardioSummary();
      })
      .catch((e: Error) => setError(e.message));

    return () => {
      deactivateProgram().catch(console.error);
    };
  }, [programId, mesocycleId, load, loadSummary, loadCardioSummary, view]);

  if (error) return <div className="empty-state"><p>{error}</p></div>;
  if (!mesocycle) return <div className="empty-state"><p>Loading...</p></div>;

  const flash = (type: string, msg: string) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 4000);
  };

  const refreshWorkouts = () => {
    setWorkouts(workoutsApi.list(mesocycle!.id));
    setCardioSessions(cardioSessionsApi.list(mesocycle!.id));
    if (view === 'summary') loadSummary();
    if (view === 'cardio') loadCardioSummary();
  };

  const handleAdd = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sessionType === 'cardio') {
      if (!cardioForm.name.trim() || !cardioForm.modality.trim()) return;
      cardioSessionsApi.create({ ...cardioForm, mesocycleId: mesocycle.id, name: cardioForm.name.trim(), modality: cardioForm.modality.trim() });
      flash('success', `"${cardioForm.name}" added.`);
      setShowModal(false);
      refreshWorkouts();
      return;
    }
    if (!woName.trim()) return;
    workoutsApi.create({
      mesocycleId: mesocycle.id,
      name: woName.trim(),
      dayOffset: addDay,
    });
    flash('success', `"${woName}" added.`);
    setShowModal(false);
    setWoName('');
    refreshWorkouts();
  };

  const handleDelete = (id: number) => {
    const w = workouts.find((x) => x.id === id);
    if (!w) return;
    setPendingDelete({ id, name: w.name });
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    workoutsApi.delete(pendingDelete.id);
    flash('success', `"${pendingDelete.name}" deleted.`);
    refreshWorkouts();
  };

  const openEdit = (workout: Workout) => {
    setEditingWorkout(workout);
    setEditName(workout.name);
    setEditDay(workout.day_offset);
  };

  const closeEdit = () => {
    if (editBusy) return;
    setEditingWorkout(null);
  };

  const handleEditSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = editName.trim();
    if (!trimmed || !editingWorkout) return;
    setEditBusy(true);
    try {
      const result = workoutsApi.update(editingWorkout.id, {
        name: trimmed,
        dayOffset: editDay,
        notes: editingWorkout.notes ?? undefined,
      });
      if (!result) throw new Error('Update returned null');
      refreshWorkouts();
      flash('success', `"${trimmed}" updated.`);
      setEditingWorkout(null);
    } catch (err) {
      flash('danger', `Could not update workout: ${(err as Error).message}`);
    } finally {
      setEditBusy(false);
    }
  };

  const handleCopy = async () => {
    const trimmed = editName.trim();
    if (!trimmed || !editingWorkout) return;
    setEditBusy(true);
    try {
      const result = workoutsApi.copy(editingWorkout.id, {
        name: `${trimmed} (Copy)`,
        dayOffset: editDay,
      });
      if (!result) throw new Error('Copy returned null');
      refreshWorkouts();
      flash('success', `"${trimmed} (Copy)" created.`);
      setEditingWorkout(null);
    } catch (err) {
      flash('danger', `Could not copy workout: ${(err as Error).message}`);
    } finally {
      setEditBusy(false);
    }
  };

  const handleEditDelete = () => {
    if (!editingWorkout) return;
    setPendingDelete({ id: editingWorkout.id, name: editingWorkout.name });
    setEditingWorkout(null);
    setShowDeleteConfirm(true);
  };

  const openAdd = (dayOffset: number) => {
    setAddDay(dayOffset);
    setWoName('');
    setSessionType('workout');
    setCardioForm({ name: '', modality: '', dayOffset, plannedDurationMinutes: 30, plannedDistance: null, targetRpe: 5, completedDurationMinutes: null, completedDistance: null, actualRpe: null, notes: '' });
    setShowModal(true);
  };

  const openEditCardio = (session: CardioSession) => {
    setEditingCardio(session);
    setCardioForm({ name: session.name, modality: session.modality, dayOffset: session.day_offset, plannedDurationMinutes: session.planned_duration_minutes, plannedDistance: session.planned_distance, targetRpe: session.target_rpe, completedDurationMinutes: session.completed_duration_minutes, completedDistance: session.completed_distance, actualRpe: session.actual_rpe, notes: session.notes || '' });
  };

  const handleCardioEdit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCardio || !cardioForm.name.trim() || !cardioForm.modality.trim()) return;
    cardioSessionsApi.update(editingCardio.id, { ...cardioForm, name: cardioForm.name.trim(), modality: cardioForm.modality.trim() });
    flash('success', `"${cardioForm.name}" updated.`);
    setEditingCardio(null);
    refreshWorkouts();
  };

  const cardioFields = () => <>
    <div className="form-group"><label htmlFor="cardio-name">Session name</label><input id="cardio-name" value={cardioForm.name} onChange={(e) => setCardioForm({ ...cardioForm, name: e.target.value })} placeholder="e.g. Easy Run" required autoFocus /></div>
    <div className="form-group"><label htmlFor="cardio-modality">Modality</label><input id="cardio-modality" value={cardioForm.modality} onChange={(e) => setCardioForm({ ...cardioForm, modality: e.target.value })} placeholder="e.g. Running, cycling, rowing" required /></div>
    <div className="generator-fields"><div className="form-group"><label htmlFor="cardio-day">Day</label><select id="cardio-day" value={cardioForm.dayOffset} onChange={(e) => setCardioForm({ ...cardioForm, dayOffset: Number(e.target.value) })}>{Array.from({ length: mesocycle.mesocycle_length }, (_, i) => <option key={i} value={i}>Day {i + 1} — {dayName(i)}</option>)}</select></div><div className="form-group"><label htmlFor="cardio-planned-minutes">Planned minutes</label><input id="cardio-planned-minutes" type="number" min={0} value={cardioForm.plannedDurationMinutes} onChange={(e) => setCardioForm({ ...cardioForm, plannedDurationMinutes: Number(e.target.value) })} required /></div></div>
    <div className="generator-fields"><div className="form-group"><label htmlFor="cardio-planned-distance">Planned distance (mi)</label><input id="cardio-planned-distance" type="number" min={0} step="0.1" value={cardioForm.plannedDistance ?? ''} onChange={(e) => setCardioForm({ ...cardioForm, plannedDistance: e.target.value === '' ? null : Number(e.target.value) })} /></div><div className="form-group"><label htmlFor="cardio-target-rpe">Target RPE (1–10)</label><input id="cardio-target-rpe" type="number" min={1} max={10} value={cardioForm.targetRpe} onChange={(e) => setCardioForm({ ...cardioForm, targetRpe: Number(e.target.value) })} required /></div></div>
    <div className="generator-fields"><div className="form-group"><label htmlFor="cardio-completed-minutes">Completed minutes</label><input id="cardio-completed-minutes" type="number" min={0} value={cardioForm.completedDurationMinutes ?? ''} onChange={(e) => setCardioForm({ ...cardioForm, completedDurationMinutes: e.target.value === '' ? null : Number(e.target.value) })} /></div><div className="form-group"><label htmlFor="cardio-completed-distance">Completed distance (mi)</label><input id="cardio-completed-distance" type="number" min={0} step="0.1" value={cardioForm.completedDistance ?? ''} onChange={(e) => setCardioForm({ ...cardioForm, completedDistance: e.target.value === '' ? null : Number(e.target.value) })} /></div><div className="form-group"><label htmlFor="cardio-actual-rpe">Actual RPE</label><input id="cardio-actual-rpe" type="number" min={1} max={10} value={cardioForm.actualRpe ?? ''} onChange={(e) => setCardioForm({ ...cardioForm, actualRpe: e.target.value === '' ? null : Number(e.target.value) })} /></div></div>
    <div className="form-group"><label htmlFor="cardio-notes">Notes</label><textarea id="cardio-notes" value={cardioForm.notes || ''} onChange={(e) => setCardioForm({ ...cardioForm, notes: e.target.value })} /></div>
  </>;

  const handleExport = async () => {
    if (!program) return;
    setExportBusy(true);
    try {
      await exportMesocycleWorkbook(program.id, program.name, mesocycle);
      flash('success', `"${mesocycle.name}" exported to Excel.`);
    } catch (err) {
      flash('danger', `Export failed: ${(err as Error).message}`);
    } finally {
      setExportBusy(false);
    }
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !program) return;
    try {
      const imported = await validateMesocycleWorkbook(file, program.id, mesocycle.id);
      setPendingImport(imported);
      setShowImportConfirm(true);
    } catch (err) {
      flash('danger', `Import failed: ${(err as Error).message}`);
      if (importFileRef.current) importFileRef.current.value = '';
    }
  };

  const cancelImport = () => {
    if (importBusy) return;
    setShowImportConfirm(false);
    setPendingImport(null);
    if (importFileRef.current) importFileRef.current.value = '';
  };

  const confirmImport = async () => {
    if (!pendingImport) return;
    setImportBusy(true);
    try {
      await replaceMesocycleFromWorkbook(mesocycle.id, pendingImport);
      load();
      if (view === 'summary') loadSummary();
      flash('success', `"${pendingImport.mesocycle.name}" imported from Excel.`);
      setShowImportConfirm(false);
      setPendingImport(null);
      if (importFileRef.current) importFileRef.current.value = '';
    } catch (err) {
      flash('danger', `Import failed: ${(err as Error).message}`);
    } finally {
      setImportBusy(false);
    }
  };

  const startDate = new Date(mesocycle.start_date + 'T00:00:00');

  const dayName = (offset: number): string => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + offset);
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  };

  return (
    <>
      <div className="breadcrumb">
        <Link to="/">Programs</Link><span>/</span>
        {program && <><Link to={`/programs/${program.id}`}>{program.name}</Link><span>/</span></>}
        <strong>{mesocycle.name}</strong>
      </div>

      <div className="page-header">
        <h1>{mesocycle.name}</h1>
        {view === 'schedule' && (
          <div className="d-flex gap-2 flex-wrap">
            <button className="btn btn-outline" onClick={handleExport} disabled={exportBusy}>{exportBusy ? 'Exporting…' : 'Export Excel'}</button>
            <button className="btn btn-outline" onClick={() => importFileRef.current?.click()}>Import Excel</button>
            <input ref={importFileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style={{ display: 'none' }} onChange={handleImportFile} />
            <button className="btn btn-outline" onClick={() => setShowGenerator(true)}>
              Generate Workouts
            </button>
          </div>
        )}
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
        Started {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} &middot; {mesocycle.mesocycle_length}-day mesocycle
      </p>

      <div className="program-tabs" style={{ marginBottom: 24 }}>
        <button
          className={view === 'schedule' ? 'active' : ''}
          onClick={() => setSearchParams({ view: 'schedule' })}
        >Schedule</button>
        <button
          className={view === 'summary' ? 'active' : ''}
          onClick={() => setSearchParams({ view: 'summary' })}
        >Strength Summary</button>
        <button
          className={view === 'cardio' ? 'active' : ''}
          onClick={() => setSearchParams({ view: 'cardio' })}
        >Cardio Summary</button>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      {view === 'summary' ? (
        <>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
            Programmed statistics &mdash; calculated from your training plan, not completed sessions.
          </p>
          <SummarySetTypeFilterControls />
          {summaryData && (
            <>
              <SummaryStatGrid
                stats={buildStatItems(summaryData.totals, [
                  { label: 'Mesocycle Days', value: formatCount(summaryData.mesocycleLength) },
                ])}
                caption="Mesocycle training summary"
              />
              {summaryData.totals.totalSets === 0 ? (
                <div className="empty-state">
                  <p>{selectedSetTypes.length === 0 ? 'Select at least one set type to see summary data.' : 'No programmed training data matches the selected set types in this mesocycle.'}</p>
                </div>
              ) : (
                <SummaryBreakdownTables
                  byExerciseGroup={summaryData.byExerciseGroup}
                  byExercise={summaryData.byExercise}
                />
              )}
            </>
          )}
        </>
      ) : view === 'cardio' ? (
        cardioSummaryData && <><p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>Planned and completed cardio for this mesocycle.</p><CardioSummary data={cardioSummaryData} /></>
      ) : (
        <div className="row g-3 mb-4">
        {Array.from({ length: mesocycle.mesocycle_length }, (_, i) => {
          const dayWorkouts = workouts.filter((w) => w.day_offset === i);
          return (
            <div className="col-6 col-sm-4 col-md-3 col-lg-2" key={i}>
              <div className="day-cell">
              <div className="day-label">
                <span>{dayName(i)}</span>
                <span>Day {i + 1}</span>
              </div>
              {dayWorkouts.map((w) => (
                <div key={w.id} className="workout-chip">
                  <Link to={`/programs/${program!.id}/workouts/${w.id}`} className="workout-chip-link">
                    {w.name}
                  </Link>
                  <button
                    className="chip-edit-btn"
                    aria-label={`Edit ${w.name}`}
                    onClick={(e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); openEdit(w); }}
                  >&#9998;</button>
                </div>
              ))}
              {cardioSessions.filter((session) => session.day_offset === i).map((session) => (
                <div key={session.id} className="workout-chip" style={{ borderColor: 'var(--accent)', background: 'var(--accent-light, #eef6ff)' }}>
                  <button className="workout-chip-link" style={{ border: 0, background: 'transparent', textAlign: 'left' }} onClick={() => openEditCardio(session)}>
                    {session.name} <small>({session.modality} · {session.planned_duration_minutes} min)</small>
                  </button>
                  <button className="chip-edit-btn" aria-label={`Edit ${session.name}`} onClick={() => openEditCardio(session)}>&#9998;</button>
                </div>
              ))}
              <button className="add-chip" onClick={() => openAdd(i)}>+ Add session</button>
              </div>
            </div>
          );
        })}
       </div>
      )}

      <FormModal show={showModal} onHide={() => setShowModal(false)} title="Add Session" onSubmit={handleAdd} submitLabel="Add">
        <div className="form-group"><label>Session type</label><select value={sessionType} onChange={(e) => setSessionType(e.target.value as 'workout' | 'cardio')}><option value="workout">Strength workout</option><option value="cardio">Cardio session</option></select></div>
        {sessionType === 'workout' ? <div className="form-group"><label>Workout Name</label><input value={woName} onChange={(e) => setWoName(e.target.value)} placeholder={`e.g. ${dayName(addDay)} Workout`} required autoFocus /></div> : cardioFields()}
      </FormModal>

      <FormModal show={!!editingCardio} onHide={() => setEditingCardio(null)} title="Edit Cardio Session" onSubmit={handleCardioEdit} submitLabel="Save Changes">
        {cardioFields()}
        {editingCardio && <button type="button" className="btn btn-danger" onClick={() => { cardioSessionsApi.delete(editingCardio.id); setEditingCardio(null); refreshWorkouts(); }}>Delete</button>}
      </FormModal>

      <ConfirmModal
        show={showDeleteConfirm}
        onHide={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Workout"
        message={`Delete "${pendingDelete?.name}"?`}
      />

      <ConfirmModal
        show={showImportConfirm}
        onHide={cancelImport}
        onConfirm={confirmImport}
        title="Replace Mesocycle from Excel"
        message={`Importing this workbook will replace all strength workouts and sets in "${mesocycle.name}". Cardio sessions will be preserved.`}
        confirmLabel={importBusy ? 'Importing...' : 'Replace Mesocycle'}
        variant="danger"
      />

      {editingWorkout && (
        <WorkoutEditModal
          show={!!editingWorkout}
          workoutName={editName}
          dayOffset={editDay}
          days={Array.from({ length: mesocycle.mesocycle_length }, (_, i) => ({
            value: i,
            label: `Day ${i + 1} — ${dayName(i)}`,
          }))}
          busy={editBusy}
          onNameChange={setEditName}
          onDayChange={setEditDay}
          onSave={handleEditSubmit}
          onCopy={handleCopy}
          onDelete={handleEditDelete}
          onHide={closeEdit}
        />
      )}

      {mesocycle && (
        <WorkoutGeneratorModal
          show={showGenerator}
          mesocycle={mesocycle}
          workouts={workouts}
          onHide={() => setShowGenerator(false)}
          onGenerated={(count) => {
            refreshWorkouts();
            flash('success', `${count} workout${count !== 1 ? 's' : ''} generated.`);
          }}
        />
      )}
    </>
  );
}
