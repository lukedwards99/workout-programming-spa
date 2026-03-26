import { Routes, Route } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import Header from './components/Header';
import DataImportExportPage from './pages/DataImportExportPage';
import OverviewPage from './pages/OverviewPage';
import DevTestPage from './pages/DevTestPage';
import { loadDatabase } from './db/databaseSetupService';
import { mesocyclesApi } from './db/databaseAPI';

const SCHEMA_VERSION = 1;


function App() {

  const [dbReady, setDbReady] = useState(false);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState(null); // { type: 'success'|'danger', message }
  const [mesocycles, setMesocycles] = useState([]);

  const handleLoadDb = async () => {
    setDbLoading(true);
    // setDbStatus(null);
    try {
      await loadDatabase(SCHEMA_VERSION);
      setDbReady(true);
      loadMesocycles();
      // setDbStatus({ type: 'success', message: `Database v${SCHEMA_VERSION} loaded from IndexedDB.` });
    } catch (e) {
      setDbStatus({ type: 'danger', message: e.message });
    } finally {
      setDbLoading(false);
    }
  };

  const loadMesocycles = useCallback(() => {
    const response = mesocyclesApi.list();
    if (response.success) {
      setMesocycles(response.data);
      // setListError(null);
    } else {
      // setListError(response.error);
    }
  }, []);

  useEffect(() => {
    if (!dbReady) {
      handleLoadDb();
      return;
    }
    loadMesocycles();
  }, [dbReady, loadMesocycles]);


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
          <Route path="/debug" element={<DevTestPage />} />
          <Route path="/" element={<OverviewPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
