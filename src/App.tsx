import { Navigate, Route, Routes } from 'react-router-dom';
import Navigation from './components/Navigation';
import { useSession } from './contexts/SessionContext';
import LocalLoginPage from './pages/LocalLoginPage';
import HomePage from './pages/HomePage';
import ProgramPage from './pages/ProgramPage';
import WorkoutPage from './pages/WorkoutPage';
import WorkspaceLibraryPage from './pages/WorkspaceLibraryPage';
import AdminUsersPage from './pages/AdminUsersPage';
import ClientsPage from './pages/ClientsPage';
import WorkspacesPage from './pages/WorkspacesPage';
import AboutPage from './pages/AboutPage';

export default function App() {
  const { principal, ready, workspaceId } = useSession();
  if (!ready) return <div className="loading-screen">Connecting to local D1…</div>;
  if (!principal) return <LocalLoginPage />;
  return <div className="app" data-testid="app-ready">
    <Navigation />
    <main className="container">
      <Routes>
        <Route path="/workspaces" element={<WorkspacesPage />} />
        {!workspaceId ? <Route path="*" element={<Navigate to="/workspaces" replace />} /> : <>
          <Route path="/" element={<HomePage />} />
          <Route path="/programs/:programId" element={<ProgramPage />} />
          <Route path="/programs/:programId/workouts/:workoutId" element={<WorkoutPage />} />
          <Route path="/library" element={<WorkspaceLibraryPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>}
      </Routes>
    </main>
  </div>;
}
