import { useState, useEffect, useCallback, useRef } from 'react';
import { getDatabaseSize, exportDatabase, importDatabase, deleteAllData } from '../db/databaseService';
import { summaryApi } from '../api/summaryApi';

export default function DataManagementPage() {
  const [stats, setStats] = useState(null);
  const [alert, setAlert] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(() => {
    setStats(summaryApi.getStats());
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (type, msg) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleExport = () => {
    const data = exportDatabase();
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workout-data-backup-${new Date().toISOString().split('T')[0]}.sqlite`;
    a.click();
    URL.revokeObjectURL(url);
    flash('success', 'Database exported successfully.');
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.sqlite')) {
      setImportStatus({ type: 'danger', msg: 'Invalid file type. Please select a .sqlite file.' });
      return;
    }
    setPendingFile(file);
    setImportStatus({ type: 'success', msg: `Valid SQLite file selected (${(file.size / 1024).toFixed(1)} KB). Click confirm to import.` });
    setShowConfirm(true);
  };

  const handleImport = async () => {
    if (!pendingFile) return;
    try {
      await importDatabase(pendingFile);
      flash('success', 'Database imported successfully. Data has been replaced.');
    } catch (e) {
      flash('danger', `Import failed: ${e.message}`);
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

  const handleDeleteAll = () => {
    if (!window.confirm('Delete ALL data? This cannot be undone. Make sure you have a backup first.')) return;
    deleteAllData();
    flash('success', 'All data deleted.');
    load();
  };

  return (
    <>
      <div className="page-header">
        <h1>Data Management</h1>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
        Export your workout data for backup or import a previously saved database.
      </p>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      {/* Stats */}
      <div className="data-card">
        <h2>Database Summary</h2>
        <div className="stats-grid">
          {stats && <>
            <div className="stat-card"><div className="val">{stats.programs}</div><div className="lbl">Programs</div></div>
            <div className="stat-card"><div className="val">{stats.mesocycles}</div><div className="lbl">Mesocycles</div></div>
            <div className="stat-card"><div className="val">{stats.workouts}</div><div className="lbl">Workouts</div></div>
            <div className="stat-card"><div className="val">{stats.exerciseGroups}</div><div className="lbl">Groups</div></div>
            <div className="stat-card"><div className="val">{stats.exercises}</div><div className="lbl">Exercises</div></div>
            <div className="stat-card"><div className="val">{stats.sets}</div><div className="lbl">Sets</div></div>
            <div className="stat-card"><div className="val">{(getDatabaseSize() / 1024).toFixed(1)} KB</div><div className="lbl">File Size</div></div>
          </>}
        </div>
      </div>

      {/* Export */}
      <div className="data-card">
        <h2>Export Database</h2>
        <p>Download your entire database as a <code>.sqlite</code> file. You can re-import this file later or transfer it to another device. This file contains raw SQLite data and is not human-readable.</p>
        <button className="btn btn-primary" onClick={handleExport}>&#x2193; Download Backup</button>
      </div>

      {/* Import */}
      <div className="data-card">
        <h2>Import Database</h2>
        <p>Upload a previously exported <code>.sqlite</code> file to restore your data. <strong style={{ color: 'var(--danger)' }}>This will replace all current data.</strong></p>

        <div className="file-drop-zone" onClick={() => fileRef.current?.click()}>
          <input type="file" ref={fileRef} accept=".sqlite" style={{ display: 'none' }} onChange={handleFileSelect} />
          <p>Drop a <code>.sqlite</code> file here or <strong style={{ color: 'var(--accent)', cursor: 'pointer' }}>click to browse</strong></p>
        </div>

        {importStatus && (
          <div className={`alert alert-${importStatus.type}`}>{importStatus.msg}</div>
        )}

        {showConfirm && (
          <>
            <div className="alert alert-warning">Are you sure you want to replace all current data with the imported file? This cannot be undone.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-danger" onClick={handleImport}>Yes, Replace My Data</button>
              <button className="btn btn-outline" onClick={cancelImport}>Cancel</button>
            </div>
          </>
        )}
      </div>

      <hr className="divider" />

      {/* Danger zone */}
      <div className="data-card" style={{ borderColor: 'var(--danger)' }}>
        <h2 style={{ color: 'var(--danger)' }}>Danger Zone</h2>
        <p>Delete all workout data. This cannot be undone. Make sure you export a backup first.</p>
        <button className="btn btn-danger" onClick={handleDeleteAll}>Delete All Data</button>
      </div>
    </>
  );
}
