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
import AboutPage from './pages/AboutPage';

export default function App() {
  const { principal, ready, workspaceId } = useSession();
  if (!ready) return <div className="loading-screen">Connecting to local D1…</div>;
  if (!principal) return <LocalLoginPage />;

  return (
    <div className="app" data-testid="app-ready">
      <Navigation />
      <main className="container">
        {!workspaceId ? <div className="empty-state"><h2>No active workspace</h2><p>Ask an owner to add this account to a workspace.</p></div> : (
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/programs/:programId" element={<ProgramPage />} />
            <Route path="/programs/:programId/workouts/:workoutId" element={<WorkoutPage />} />
            <Route path="/library" element={<WorkspaceLibraryPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>
    </div>
  );
}
