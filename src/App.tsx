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
  const { principal, ready, workspaceId, sessionError, refresh } = useSession();
  if (!ready) return <div className="loading-screen">Connecting to LiftLog…</div>;
  if (sessionError) return <main className="loading-screen"><h1>Connection interrupted</h1><p>{sessionError}</p><button className="btn btn-primary" onClick={() => void refresh()}>Reconnect</button></main>;
  if (!principal) return __HOSTED__ ? <main className="container py-5">
    <h1>Sign in to LiftLog</h1>
    <p>Your session could not be verified. Check your connection and sign in with your allowed email address.</p>
    <a className="btn btn-primary" href="/cdn-cgi/access/logout">Sign in again</a>
  </main> : <LocalLoginPage />;
  return <div className="app" data-testid="app-ready">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <Navigation />
    {__HOSTED__ && <div className="alert alert-warning m-3" role="status">Development preview: all data in this environment resets on every deployment.</div>}
    <main id="main-content" className="app-content" key={`${principal.userId}:${workspaceId}`}>
      <Routes>
        <Route path="/workspaces" element={<WorkspacesPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        {!workspaceId ? <Route path="*" element={<Navigate to="/workspaces" replace />} /> : <>
          <Route path="/" element={<HomePage />} />
          <Route path="/programs/:programId" element={<ProgramPage />} />
          <Route path="/programs/:programId/workouts/:workoutId" element={<WorkoutPage />} />
          <Route path="/library" element={<WorkspaceLibraryPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>}
      </Routes>
    </main>
  </div>;
}
