import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createSampleProgram } from '../api/sampleProgramApi';

export default function TutorialPage() {
  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreateSample = async () => {
    setBusy(true);
    setError(null);
    setCreatedId(null);
    try {
      const { programId } = await createSampleProgram();
      setCreatedId(programId);
    } catch (err) {
      setError(`Failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="breadcrumb">
        <Link to="/">Home</Link><span>/</span><strong>Tutorial</strong>
      </div>

      <div className="page-header">
        <h1>Getting Started with LiftLog</h1>
      </div>

      <div className="data-card">
        <h2>What is LiftLog?</h2>
        <p>
          LiftLog is a browser-based workout programming tool that helps you plan and organize your
          strength training. Create training programs, break them into mesocycles (training blocks),
          and design individual workouts with exercises, sets, planned and actual reps, weights, and more.
        </p>
      </div>

      <div className="data-card">
        <h2>Key Concepts</h2>
        <p><strong>Programs</strong> — A training program is your top-level container. For example, "Push/Pull/Legs 2025" or "5/3/1 Cycle 1". Each program has its own exercise library, mesocycles, and workouts.</p>
        <p><strong>Mesocycles</strong> — A mesocycle is a training block within a program, typically lasting 1-8 weeks. You define its length in days and add workouts to specific days.</p>
        <p><strong>Workouts</strong> — A workout is a single training session on a specific day of the mesocycle. Each workout contains exercises with sets.</p>
        <p><strong>Exercises &amp; Sets</strong> — Exercises are drawn from your program's exercise library. Each exercise can have multiple sets with different types (normal, warmup, dropset, failure, rest-pause), planned reps, actual reps, weight, and Reps in Reserve (RIR).</p>
        <p><strong>Summary Statistics</strong> — View programmed training volume, working sets, and exercise breakdowns at the program, mesocycle, and workout levels. All stats are labeled "programmed" since they reflect your plan, not completed sessions.</p>
      </div>

      <div className="data-card">
        <h2>Quick Start</h2>
        <p>
          1. Create a Program from the home page.<br />
          2. Add a Mesocycle to define your training block.<br />
          3. Add Workouts to specific days of the mesocycle.<br />
          4. Inside each workout, add Exercises from your library and define Sets with planned reps, actual reps, weight, and type.<br />
          5. View your programmed statistics on the Summary tab.
        </p>
      </div>

      <div className="data-card" style={{ textAlign: 'center' }}>
        <h2>Try It Out</h2>
        <p>Not sure where to start? Create a fully-populated sample program to explore LiftLog's features with real data.</p>
        <button className="btn btn-primary" onClick={handleCreateSample} disabled={busy} style={{ fontSize: 16, padding: '12px 32px' }}>
          {busy ? 'Creating...' : 'Create Sample Program'}
        </button>
        {createdId && (
          <div className="alert alert-success" style={{ marginTop: 16 }}>
            "Getting Started" created. <Link to={`/programs/${createdId}`}>Open program</Link>
          </div>
        )}
        {error && (
          <div className="alert alert-danger" style={{ marginTop: 16 }}>{error}</div>
        )}
      </div>
    </>
  );
}
