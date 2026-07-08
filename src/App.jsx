import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { initDatabase } from './db/databaseService';
import Navigation from './components/Navigation';
import HomePage from './pages/HomePage';
import ProgramPage from './pages/ProgramPage';
import ProgramExercisesPage from './pages/ProgramExercisesPage';
import ProgramDataPage from './pages/ProgramDataPage';
import MesocyclePage from './pages/MesocyclePage';
import WorkoutPage from './pages/WorkoutPage';

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    initDatabase()
      .then(() => setReady(true))
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="loading-screen">
        <div>
          <p style={{ color: 'var(--danger)' }}>Failed to initialize database:</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return <div className="loading-screen">Loading database...</div>;
  }

  return (
    <div className="app">
      <Navigation />
      <div className="container">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/programs/:programId" element={<ProgramPage />} />
          <Route path="/programs/:programId/exercises" element={<ProgramExercisesPage />} />
          <Route path="/programs/:programId/data" element={<ProgramDataPage />} />
          <Route path="/mesocycles/:mesocycleId" element={<MesocyclePage />} />
          <Route path="/workouts/:workoutId" element={<WorkoutPage />} />
        </Routes>
      </div>
    </div>
  );
}
