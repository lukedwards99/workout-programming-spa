import { Link } from 'react-router-dom';

export default function AboutPage() {
  return (
    <>
      <div className="breadcrumb">
        <Link to="/">Home</Link><span>/</span><strong>About</strong>
      </div>

      <div className="page-header">
        <h1>About LiftLog</h1>
      </div>

      <div className="data-card">
        <h2>What is LiftLog?</h2>
        <p>
          LiftLog is a browser-based workout programming tool. Build training programs, organize
          mesocycles, and design detailed workouts — all in your browser. Your data stays on your
          device using IndexedDB + SQLite.
        </p>
      </div>

      <div className="data-card">
        <h2>Technology</h2>
        <p>
          LiftLog runs entirely in your browser using React, TypeScript, and SQLite (via sql.js
          compiled to WebAssembly). There are no servers, no accounts, and no cloud storage. Your
          training data lives in your browser's IndexedDB database and never leaves your device.
        </p>
      </div>

      <div className="data-card">
        <h2>Data Management</h2>
        <p>
          You can export and import exercise libraries between programs, download full SQLite backups,
          and restore programs from backup files. Use the Data tab inside any program to access these
          tools.
        </p>
      </div>
    </>
  );
}
