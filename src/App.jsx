import { Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Navigation from './components/jsx/Navigation';
import Footer from './components/jsx/Footer';
import WeekView from './pages/jsx/WeekView';
import Setup from './pages/jsx/Setup';
import DayWorkout from './pages/jsx/DayWorkout';
import DataManagement from './pages/jsx/DataManagement';
import { initDatabase } from './db/database';
import './App.css';

function App() {
  const [dbInitialized, setDbInitialized] = useState(false);
  const [dbError, setDbError] = useState(null);

  useEffect(() => {
    const initDb = async () => {
      try {
        await initDatabase();
        setDbInitialized(true);
      } catch (error) {
        console.error('Failed to initialize database:', error);
        setDbError(error.message);
      }
    };

    initDb();
  }, []);

  if (dbError) {
    return (
      <div className="app">
        <div className="container mt-5">
          <div className="alert alert-danger">
            <h4>Database Error</h4>
            <p>Failed to initialize the database: {dbError}</p>
            <p>Please refresh the page to try again.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!dbInitialized) {
    return (
      <div className="app">
        <div className="container mt-5">
          <div className="text-center">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3">Initializing database...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Navigation />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<WeekView />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/day/:dayId" element={<DayWorkout />} />
          <Route path="/data" element={<DataManagement />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;
