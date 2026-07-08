import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getDatabaseSize, exportDatabase, importDatabase, deleteAllData } from '../db/databaseService';
import { programsApi } from '../api/programsApi';
import { mesocyclesApi } from '../api/mesocyclesApi';
import { workoutsApi } from '../api/workoutsApi';
import { exerciseGroupsApi } from '../api/exerciseGroupsApi';
import { exercisesApi } from '../api/exercisesApi';
import { exerciseVariationsApi } from '../api/exerciseVariationsApi';
import { workoutSetsApi } from '../api/workoutSetsApi';
import { summaryApi } from '../api/summaryApi';

export default function ProgramDataPage() {
  const { programId } = useParams();
  const pid = Number(programId);
  const [program, setProgram] = useState(null);
  const [stats, setStats] = useState(null);
  const [alert, setAlert] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(() => {
    const p = programsApi.get(pid);
    if (!p) return;
    setProgram(p);
    setStats(summaryApi.getStats(pid));
  }, [pid]);

  useEffect(() => { load(); }, [load]);

  if (!program) return <div className="empty-state"><p>Program not found.</p></div>;

  const flash = (type, msg) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 5000);
  };

  // ── Program-level JSON Export/Import ──
  const handleExportProgram = () => {
    const groups = exerciseGroupsApi.list(pid);
    const exs = exercisesApi.list(pid, null).map((e) => {
      const vars = exerciseVariationsApi.list(e.id);
      return { ...e, variations: vars || [] };
    });

    const exportData = {
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

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      setImportStatus({ type: 'danger', msg: 'Invalid file type. Please select a .json file.' });
      return;
    }
    setPendingFile(file);
    setImportStatus({ type: 'success', msg: `File selected (${(file.size / 1024).toFixed(1)} KB). Click confirm to import exercises.` });
    setShowConfirm(true);
  };

  const handleImport = async () => {
    if (!pendingFile) return;
    try {
      const text = await pendingFile.text();
      const data = JSON.parse(text);
      if (data.type !== 'program-export') {
        flash('danger', 'File is not a valid program export.');
        cancelImport();
        return;
      }

      // Import exercise groups and exercises
      for (const grp of data.exerciseGroups) {
        exerciseGroupsApi.findOrCreate(pid, grp.name);
      }

      for (const ex of data.exercises) {
        const group = exerciseGroupsApi.findOrCreate(pid, ex.groupName);
        // Skip if exercise with same name already exists in this group
        const existing = exercisesApi.list(pid, group.id).find((e) => e.name === ex.name);
        if (existing) {
          // Add variations if new
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
      flash('danger', `Import failed: ${err.message}`);
    }
    cancelImport();
    load();
  };

  const cancelImport = () => {
    setPendingFile(null);
    setImportStatus(null);
    setShowConfirm(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  // ── Full Database Backup ──
  const handleFullExport = () => {
    const data = exportDatabase();
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workout-data-backup-${new Date().toISOString().split('T')[0]}.sqlite`;
    a.click();
    URL.revokeObjectURL(url);
    flash('success', 'Full database backup exported.');
  };

  const handleFullImport = async () => {
    // Trigger file picker for .sqlite
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.sqlite';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        await importDatabase(file);
        flash('success', 'Database imported successfully.');
        load();
      } catch (err) {
        flash('danger', `Import failed: ${err.message}`);
      }
    };
    input.click();
  };

  const handleDeleteAll = () => {
    if (!window.confirm('Delete ALL data across all programs? This cannot be undone.')) return;
    deleteAllData();
    flash('success', 'All data deleted.');
    load();
  };

  const DEFAULT_EXERCISES = [
    { group: 'Chest', exercises: ['Bench Press', 'Incline Dumbbell Press', 'Dumbbell Flyes', 'Cable Crossover', 'Push Ups'] },
    { group: 'Back', exercises: ['Pull Ups', 'Barbell Row', 'Lat Pulldown', 'Seated Cable Row', 'Face Pulls'] },
    { group: 'Shoulders', exercises: ['Overhead Press', 'Lateral Raise', 'Rear Delt Fly', 'Arnold Press'] },
    { group: 'Arms', exercises: ['Barbell Curl', 'Hammer Curl', 'Tricep Pushdown', 'Skullcrusher', 'Preacher Curl'] },
    { group: 'Legs', exercises: ['Barbell Squat', 'Deadlift', 'Leg Press', 'Romanian Deadlift', 'Calf Raise', 'Bulgarian Split Squat'] },
    { group: 'Core', exercises: ['Plank', 'Hanging Leg Raise', 'Cable Crunch', 'Ab Wheel Rollout'] },
  ];

  const handleSeedDefaults = () => {
    if (!window.confirm(`Seed default exercise library into "${program.name}"? Existing exercises will not be duplicated.`)) return;
    let addedCount = 0;
    for (const { group, exercises } of DEFAULT_EXERCISES) {
      const grp = exerciseGroupsApi.findOrCreate(pid, group);
      for (const name of exercises) {
        const existing = exercisesApi.list(pid, grp.id).find((e) => e.name === name);
        if (existing) continue;
        exercisesApi.create({ groupId: grp.id, name });
        addedCount++;
      }
    }
    flash('success', `${addedCount} exercises seeded into "${program.name}".`);
    load();
  };

  return (
    <>
      <div className="page-header">
        <h1>Data Management</h1>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      {/* Program Stats */}
      <div className="data-card">
        <h2>Program Summary</h2>
        <div className="stats-grid">
          {stats && <>
            <div className="stat-card"><div className="val">{stats.mesocycles}</div><div className="lbl">Mesocycles</div></div>
            <div className="stat-card"><div className="val">{stats.workouts}</div><div className="lbl">Workouts</div></div>
            <div className="stat-card"><div className="val">{stats.exerciseGroups}</div><div className="lbl">Groups</div></div>
            <div className="stat-card"><div className="val">{stats.exercises}</div><div className="lbl">Exercises</div></div>
            <div className="stat-card"><div className="val">{stats.sets}</div><div className="lbl">Sets</div></div>
          </>}
        </div>
      </div>

      {/* Program Export */}
      <div className="data-card">
        <h2>Export Program Exercises</h2>
        <p>Download this program's exercise library as a <code>.json</code> file. You can import it into another program. <strong>Note: this only exports exercises, not workout data.</strong></p>
        <button className="btn btn-primary" onClick={handleExportProgram}>&#x2193; Export Exercises</button>
      </div>

      {/* Program Import */}
      <div className="data-card">
        <h2>Import Exercises into Program</h2>
        <p>Upload a previously exported program <code>.json</code> file. Exercises will be merged into this program (same-named groups will be reused).</p>

        <div className="file-drop-zone" onClick={() => fileRef.current?.click()}>
          <input type="file" ref={fileRef} accept=".json" style={{ display: 'none' }} onChange={handleFileSelect} />
          <p>Drop a <code>.json</code> file here or <strong style={{ color: 'var(--accent)', cursor: 'pointer' }}>click to browse</strong></p>
        </div>

        {importStatus && (
          <div className={`alert alert-${importStatus.type}`}>{importStatus.msg}</div>
        )}

        {showConfirm && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={handleImport}>Import Exercises</button>
            <button className="btn btn-outline" onClick={cancelImport}>Cancel</button>
          </div>
        )}
      </div>

      <hr className="divider" />

      {/* Full Database Backup */}
      <div className="data-card" style={{ opacity: 0.7 }}>
        <h2>Full Database Backup</h2>
        <p>Backup or restore your entire database including all programs and workout data. This exports as a <code>.sqlite</code> binary file.</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={handleFullExport}>&#x2193; Download Full Backup</button>
          <button className="btn btn-outline" onClick={handleFullImport}>&#x2191; Restore Full Backup</button>
          <button className="btn btn-outline" onClick={handleSeedDefaults}>Seed Default Exercises</button>
          <button className="btn btn-danger btn-sm" onClick={handleDeleteAll}>Delete All Data</button>
        </div>
      </div>
    </>
  );
}
