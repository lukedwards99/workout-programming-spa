import { useState, useEffect, useCallback, useRef, type ChangeEvent, type MouseEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Program, ProgramSummaryStats } from '../types/domain';
import type { BackupMetadata, ExportedExerciseVariation, ExportedExercise, ExerciseJSONExport } from '../types/api';
import {
  getDatabaseSize, saveNow, exportProgramBackup, importProgramBackup, validateProgramBackup,
  activateProgram,
} from '../db/databaseService';
import { programsApi } from '../api/programsApi';
import { exerciseGroupsApi } from '../api/exerciseGroupsApi';
import { exercisesApi } from '../api/exercisesApi';
import { exerciseVariationsApi } from '../api/exerciseVariationsApi';
import { summaryApi } from '../api/summaryApi';
import { ConfirmModal } from '../components';

interface Alert {
  type: string;
  msg: string;
}

interface ImportStatus {
  type: string;
  msg: string;
}

interface PendingRestore {
  file: File;
  buffer: ArrayBuffer;
}

export default function ProgramDataPage() {
  const { programId } = useParams<{ programId: string }>();
  const pid = Number(programId);
  const [program, setProgram] = useState<Program | null>(null);
  const [stats, setStats] = useState<ProgramSummaryStats | null>(null);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [showSeedConfirm, setShowSeedConfirm] = useState(false);

  // Program backup/restore
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);
  const [pendingRestoreMeta, setPendingRestoreMeta] = useState<BackupMetadata | null>(null);
  const fileRestoreRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    const p = programsApi.get(pid);
    if (!p) return;
    setProgram(p);
    setStats(summaryApi.getStats());
  }, [pid]);

  useEffect(() => { load(); }, [load]);

  if (!program) return <div className="empty-state"><p>Program not found.</p></div>;

  const flash = (type: string, msg: string) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 5000);
  };

  // ── Exercise JSON Export ──
  const handleExportExercises = () => {
    const groups = exerciseGroupsApi.list();
    const exs = exercisesApi.list(null).map((e) => {
      const vars = exerciseVariationsApi.list(e.id);
      return { ...e, variations: vars || [] };
    });

    const exportData: ExerciseJSONExport = {
      version: 1,
      type: 'program-export',
      exportedAt: new Date().toISOString(),
      program: { name: program.name, notes: program.notes || '' },
      exerciseGroups: groups.map((g) => ({ name: g.name, notes: g.notes || '' })),
      exercises: exs.map((e) => ({
        name: e.name,
        tutorialUrl: e.tutorial_url || '',
        notes: e.notes || '',
        groupName: groups.find((g) => g.id === e.exercise_group_id)?.name || '',
        variations: (e.variations || []).map((v) => ({
          name: v.name,
          isPrimary: !!v.is_primary,
          tutorialUrl: v.tutorial_url || '',
          notes: v.notes || '',
        })),
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = program.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    a.download = `program-${safeName}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash('success', `"${program.name}" exercises exported.`);
  };

  // ── Exercise JSON Import ──
  const handleExerciseFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      setImportStatus({ type: 'danger', msg: 'Invalid file type. Please select a .json file.' });
      return;
    }
    setPendingFile(file);
    setImportStatus({ type: 'success', msg: `File selected (${(file.size / 1024).toFixed(1)} KB). Click confirm to import exercises.` });
    setShowImportConfirm(true);
  };

  const handleExerciseImport = async () => {
    if (!pendingFile) return;
    try {
      const text = await pendingFile.text();
      const data = JSON.parse(text) as ExerciseJSONExport;
      if (data.type !== 'program-export') {
        flash('danger', 'File is not a valid program export.');
        cancelExerciseImport();
        return;
      }

      for (const grp of data.exerciseGroups) {
        exerciseGroupsApi.findOrCreate(grp.name);
      }

      for (const ex of data.exercises) {
        const group = exerciseGroupsApi.findOrCreate(ex.groupName!);
        const existing = exercisesApi.list(group.id).find((e) => e.name === ex.name);
        if (existing) {
          for (const v of (ex.variations || [])) {
            const existingVars = exerciseVariationsApi.list(existing.id);
            if (!existingVars.find((ev) => ev.name === v.name)) {
              exerciseVariationsApi.create({
                exerciseId: existing.id,
                name: v.name,
                isPrimary: v.isPrimary,
                tutorialUrl: v.tutorialUrl,
                notes: v.notes,
              });
            }
          }
          continue;
        }
        const newEx = exercisesApi.create({
          groupId: group.id,
          name: ex.name,
          tutorialUrl: ex.tutorialUrl,
          notes: ex.notes,
        });
        if (!newEx) continue;

        for (const v of (ex.variations || [])) {
          exerciseVariationsApi.create({
            exerciseId: newEx.id,
            name: v.name,
            isPrimary: v.isPrimary,
            tutorialUrl: v.tutorialUrl,
            notes: v.notes,
          });
        }
      }

      flash('success', `Exercises imported into "${program.name}".`);
    } catch (err) {
      flash('danger', `Import failed: ${(err as Error).message}`);
    }
    cancelExerciseImport();
    load();
  };

  const cancelExerciseImport = () => {
    setPendingFile(null);
    setImportStatus(null);
    setShowImportConfirm(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  // ── Program Backup (SQLite) ──
  const handleProgramBackup = async () => {
    try {
      await saveNow();
      const data = await exportProgramBackup(pid);
      const blob = new Blob([data as BlobPart], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = program.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      a.download = `program-backup-${safeName}-${new Date().toISOString().split('T')[0]}.sqlite`;
      a.click();
      URL.revokeObjectURL(url);
      flash('success', 'Program backup downloaded.');
    } catch (err) {
      flash('danger', `Backup failed: ${(err as Error).message}`);
    }
  };

  // ── Program Restore ──
  const handleRestoreFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const result = await validateProgramBackup(buffer);
      if (!result.valid) {
        flash('danger', result.error || 'Unknown validation error');
        return;
      }
      setPendingRestoreMeta(result.meta || null);
      setPendingRestore({ file, buffer });
      setShowRestoreConfirm(true);
    } catch (err) {
      flash('danger', `Validation failed: ${(err as Error).message}`);
    }
  };

  const confirmProgramRestore = async () => {
    if (!pendingRestore) return;
    try {
      await saveNow();
      const meta = await importProgramBackup(pid, pendingRestore.buffer);
      await activateProgram(pid, { skipSave: true });
      flash('success', `Program restored from backup: "${meta.program_name || program.name}".`);
      load();
    } catch (err) {
      flash('danger', `Restore failed: ${(err as Error).message}`);
    }
    setShowRestoreConfirm(false);
    setPendingRestore(null);
    setPendingRestoreMeta(null);
    if (fileRestoreRef.current) fileRestoreRef.current.value = '';
  };

  // ── Seed Default Exercises ──
  const DEFAULT_EXERCISES = [
    { group: 'Chest', exercises: ['Bench Press', 'Incline Dumbbell Press', 'Dumbbell Flyes', 'Cable Crossover', 'Push Ups'] },
    { group: 'Back', exercises: ['Pull Ups', 'Barbell Row', 'Lat Pulldown', 'Seated Cable Row', 'Face Pulls'] },
    { group: 'Shoulders', exercises: ['Overhead Press', 'Lateral Raise', 'Rear Delt Fly', 'Arnold Press'] },
    { group: 'Arms', exercises: ['Barbell Curl', 'Hammer Curl', 'Tricep Pushdown', 'Skullcrusher', 'Preacher Curl'] },
    { group: 'Legs', exercises: ['Barbell Squat', 'Deadlift', 'Leg Press', 'Romanian Deadlift', 'Calf Raise', 'Bulgarian Split Squat'] },
    { group: 'Core', exercises: ['Plank', 'Hanging Leg Raise', 'Cable Crunch', 'Ab Wheel Rollout'] },
  ];

  const confirmSeed = () => {
    let addedCount = 0;
    for (const { group, exercises } of DEFAULT_EXERCISES) {
      const grp = exerciseGroupsApi.findOrCreate(group);
      for (const name of exercises) {
        const existing = exercisesApi.list(grp.id).find((e) => e.name === name);
        if (existing) continue;
        exercisesApi.create({ groupId: grp.id, name });
        addedCount++;
      }
    }
    flash('success', `${addedCount} exercises seeded into "${program.name}".`);
    load();
  };

  const dbSize = getDatabaseSize();

  return (
    <>
      <div className="page-header">
        <h1>Data Management</h1>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      <div className="data-card">
        <h2>Exercise Library</h2>
        <div className="stats-grid">
          {stats && <>
            <div className="stat-card"><div className="val">{stats.exerciseGroups}</div><div className="lbl">Groups</div></div>
            <div className="stat-card"><div className="val">{stats.exercises}</div><div className="lbl">Exercises</div></div>
          </>}
        </div>
      </div>

      <div className="data-card">
        <h2>Export Program Exercises</h2>
        <p>Download this program's exercise library as a <code>.json</code> file. You can import it into another program. <strong>Note: this only exports exercises, not workout data.</strong></p>
        <button className="btn btn-primary" onClick={handleExportExercises}>&#x2193; Export Exercises</button>
      </div>

      <div className="data-card">
        <h2>Import Exercises into Program</h2>
        <p>Upload a previously exported program <code>.json</code> file. Exercises will be merged into this program (same-named groups will be reused).</p>

        <div className="file-drop-zone" onClick={() => fileRef.current?.click()}>
          <input type="file" ref={fileRef} accept=".json" style={{ display: 'none' }} onChange={handleExerciseFileSelect} />
          <p>Drop a <code>.json</code> file here or <strong style={{ color: 'var(--accent)', cursor: 'pointer' }}>click to browse</strong></p>
        </div>

        {importStatus && (
          <div className={`alert alert-${importStatus.type}`}>{importStatus.msg}</div>
        )}
      </div>

      <hr className="divider" />

      <div className="data-card">
        <h2>Program Backup</h2>
        <p>Download a complete SQLite backup of this program including all mesocycles, workouts, exercise library, and workout sets. Use the restore option to revert this program to a previous state.</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Current database size: {(dbSize / 1024).toFixed(1)} KB</p>
        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-outline" onClick={handleProgramBackup}>&#x2193; Download Program Backup</button>
          <button className="btn btn-outline" onClick={() => fileRestoreRef.current?.click()}>Restore Program Backup</button>
          <input type="file" ref={fileRestoreRef} accept=".sqlite" style={{ display: 'none' }} onChange={handleRestoreFileSelect} />
        </div>
      </div>

      <hr className="divider" />

      <div className="data-card">
        <h2>Exercise Library Utilities</h2>
        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-outline" onClick={() => setShowSeedConfirm(true)}>Seed Default Exercises</button>
        </div>
      </div>

      {/* Exercise Import Confirm */}
      <ConfirmModal
        show={showImportConfirm}
        onHide={cancelExerciseImport}
        onConfirm={handleExerciseImport}
        title="Import Exercises"
        message="Import exercises from this JSON file into the current program? Exercises with the same name will be merged."
        confirmLabel="Import Exercises"
        variant="primary"
      />

      {/* Seed Confirm */}
      <ConfirmModal
        show={showSeedConfirm}
        onHide={() => setShowSeedConfirm(false)}
        onConfirm={confirmSeed}
        title="Seed Default Exercises"
        message={`Seed default exercise library into "${program.name}"? Existing exercises will not be duplicated.`}
        confirmLabel="Seed"
        variant="primary"
      />

      {/* Program Restore Confirm */}
      <ConfirmModal
        show={showRestoreConfirm}
        onHide={() => { setShowRestoreConfirm(false); setPendingRestore(null); setPendingRestoreMeta(null); if (fileRestoreRef.current) fileRestoreRef.current.value = ''; }}
        onConfirm={confirmProgramRestore}
        title="Restore Program Backup"
        message={`Restore "${program.name}" from backup? This will replace all mesocycles, workouts, exercises, and sets for this program. This cannot be undone.\n\nBackup info: ${pendingRestoreMeta ? `"${pendingRestoreMeta.program_name}" — exported ${pendingRestoreMeta.exported_at || 'unknown date'}` : ''}`}
        confirmLabel="Restore"
        variant="danger"
      />
    </>
  );
}
