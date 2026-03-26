import { Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Header from './components/Header';
import DataImportExportPage from './pages/DataImportExportPage';
import OverviewPage from './pages/OverviewPage';
import DevTestPage from './pages/DevTestPage';

function App() {

  const [dbInitialized, setDbInitialized] = useState(false);

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
          <Route path="/data" element={<DataImportExportPage/>} />
          <Route path="/" element={<OverviewPage/>} />
          <Route path="/debug" element={<DevTestPage/>} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
