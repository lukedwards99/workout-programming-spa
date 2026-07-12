import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { initDatabase } from './db/databaseService';
import Navigation from './components/Navigation';
import HomePage from './pages/HomePage';
import ProgramPage from './pages/ProgramPage';
import ProgramMesocyclesTab from './pages/ProgramMesocyclesTab';
import ProgramExercisesPage from './pages/ProgramExercisesPage';
import ProgramDataPage from './pages/ProgramDataPage';
import ProgramSummaryPage from './pages/ProgramSummaryPage';
import TutorialPage from './pages/TutorialPage';
import AboutPage from './pages/AboutPage';
import MesocyclePage from './pages/MesocyclePage';
import WorkoutPage from './pages/WorkoutPage';

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initDatabase()
      .then(() => setReady(true))
      .catch((e: Error) => setError(e.message));
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
          <Route path="/tutorial" element={<TutorialPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/programs/:programId" element={<ProgramPage />}>
            <Route index element={<ProgramMesocyclesTab />} />
            <Route path="exercises" element={<ProgramExercisesPage />} />
            <Route path="data" element={<ProgramDataPage />} />
            <Route path="summary" element={<ProgramSummaryPage />} />
          </Route>
          <Route path="/programs/:programId/mesocycles/:mesocycleId" element={<MesocyclePage />} />
          <Route path="/programs/:programId/workouts/:workoutId" element={<WorkoutPage />} />
          {/* Legacy route redirects */}
          <Route path="/mesocycles/:mesocycleId" element={<MesocycleFallback />} />
          <Route path="/workouts/:workoutId" element={<WorkoutFallback />} />
        </Routes>
      </div>
    </div>
  );
}

function MesocycleFallback() {
  return <div className="empty-state"><p>Please navigate via a program. Legacy URLs are no longer supported.</p></div>;
}

function WorkoutFallback() {
  return <div className="empty-state"><p>Please navigate via a program. Legacy URLs are no longer supported.</p></div>;
}
