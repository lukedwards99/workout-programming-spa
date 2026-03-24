import { Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Header from './components/Header';
import DataImportExportPage from './pages/DataImportExportPage';
import OverviewPage from './pages/OverviewPage';

function App() {

  const [dbInitialized, setDbInitialized] = useState(false);

  return (
    <div className="app">
      <main className="main-content">
        <Header/>
        <Routes>
          {/* <Route path="/" element={<WeekView />} />
          <Route path="/setup" element={<ExerciseSetup />} />
          <Route path="/day/:dayId" element={<DayWorkout />} />
          <Route path="/data" element={<DataManagement />} />
          <Route path="/summary" element={<Summary />} /> */}
          <Route path="/data" element={<DataImportExportPage/>} />
          <Route path="/" element={<OverviewPage></OverviewPage>} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
