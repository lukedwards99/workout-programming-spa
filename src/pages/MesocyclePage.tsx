import { useState, useEffect, useCallback, useRef, type ChangeEvent, type FormEvent, type MouseEvent } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import type { Program, Mesocycle, Workout, MesocycleTrainingSummary } from '../types/domain';
import { activateProgram, deactivateProgram } from '../db/databaseService';
import { programsApi } from '../api/programsApi';
import { mesocyclesApi } from '../api/mesocyclesApi';
import { workoutsApi } from '../api/workoutsApi';
import { summaryApi } from '../api/summaryApi';
import { exportMesocycleWorkbook, replaceMesocycleFromWorkbook, validateMesocycleWorkbook, type ImportedMesocycleWorkbook } from '../api/mesocycleSpreadsheetApi';
import { FormModal, ConfirmModal, WorkoutEditModal } from '../components';
import WorkoutGeneratorModal from '../components/workout-generator/WorkoutGeneratorModal';
import SummaryStatGrid, { buildStatItems } from '../components/summary/SummaryStatGrid';
import SummaryBreakdownTables from '../components/summary/SummaryBreakdownTables';
import { formatCount } from '../components/summary/formatSummary';

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
  const view = rawView === 'summary' ? 'summary' : 'schedule';
  const [mesocycle, setMesocycle] = useState<Mesocycle | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [program, setProgram] = useState<Program | null>(null);
  const [summaryData, setSummaryData] = useState<MesocycleTrainingSummary | null>(null);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [addDay, setAddDay] = useState(0);
  const [woName, setWoName] = useState('');
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

  const load = useCallback(() => {
    const m = mesocyclesApi.get(Number(mesocycleId));
    if (!m) {
      setError('Mesocycle not found in this program.');
      return;
    }
    setMesocycle(m);
    setWorkouts(workoutsApi.list(m.id));
    setError(null);
  }, [mesocycleId]);

  const loadSummary = useCallback(() => {
    const data = summaryApi.getMesocycleSummary(Number(mesocycleId));
    setSummaryData(data);
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
      })
      .catch((e: Error) => setError(e.message));

    return () => {
      deactivateProgram().catch(console.error);
    };
  }, [programId, mesocycleId, load, loadSummary, view]);

  if (error) return <div className="empty-state"><p>{error}</p></div>;
  if (!mesocycle) return <div className="empty-state"><p>Loading...</p></div>;

  const flash = (type: string, msg: string) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 4000);
  };

  const refreshWorkouts = () => {
    setWorkouts(workoutsApi.list(mesocycle!.id));
    if (view === 'summary') loadSummary();
  };

  const handleAdd = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
    setShowModal(true);
  };

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
        >Summary</button>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      {view === 'summary' ? (
        <>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
            Programmed statistics &mdash; calculated from your training plan, not completed sessions.
          </p>
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
                  <p>No programmed training data yet for this mesocycle. Add workouts and sets to see statistics.</p>
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
              <button className="add-chip" onClick={() => openAdd(i)}>+ Add workout</button>
              </div>
            </div>
          );
        })}
       </div>
      )}

      <FormModal show={showModal} onHide={() => setShowModal(false)} title="Add Workout" onSubmit={handleAdd} submitLabel="Add">
        <div className="form-group">
          <label>Workout Name</label>
          <input
            value={woName} onChange={(e) => setWoName(e.target.value)}
            placeholder={`e.g. ${dayName(addDay)} Workout`}
            required autoFocus
          />
        </div>
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
        message={`Importing this workbook will replace all workouts and sets in "${mesocycle.name}". This cannot be undone.`}
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
