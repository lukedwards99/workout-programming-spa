import { Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import DataImportExportPage from './pages/DataImportExportPage';
import OverviewPage from './pages/OverviewPage';
import ProgramPage from './pages/ProgramPage';
import { loadDatabase } from './db/databaseSetupService';

const SCHEMA_VERSION = 1;


function App() {

  const [dbReady, setDbReady] = useState(false);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState(null); // { type: 'success'|'danger', message }

  const handleLoadDb = async () => {
    setDbLoading(true);
    // setDbStatus(null);
    try {
      console.log("creating database")
      await loadDatabase(SCHEMA_VERSION);
      setDbReady(true);
      // setDbStatus({ type: 'success', message: `Database v${SCHEMA_VERSION} loaded from IndexedDB.` });
    } catch (e) {
      console.error('Error loading database:', e);
      setDbStatus({ type: 'danger', message: e.message });
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    if (!dbReady) {
      handleLoadDb();
    }
  }, [dbReady]);


  if (dbLoading || !dbReady) {
    return (  
      <div className="app">
        <main className="main-content">
          <div className="loading-indicator">Loading database...</div>
          {dbStatus && (
            <div className={`status-message ${dbStatus.type}`}>
              {dbStatus.message}
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <main className="main-content">
        {/* <Header/> */}
        <Routes>
          {/* <Route path="/" element={<WeekView />} />
          <Route path="/setup" element={<ExerciseSetup />} />
          <Route path="/day/:dayId" element={<DayWorkout />} />
          <Route path="/data" element={<DataManagement />} />
          <Route path="/summary" element={<Summary />} /> */}
          <Route path="/data" element={<DataImportExportPage />} />
          <Route path="/programs/:programId" element={<ProgramPage />} />
          <Route path="/" element={<OverviewPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
