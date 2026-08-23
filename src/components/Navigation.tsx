import { NavLink } from 'react-router-dom';
import { useSession } from '../contexts/SessionContext';

export default function Navigation() {
  const { principal, workspaceId, setWorkspaceId, logout } = useSession();
  const membership = principal?.memberships.find((item) => item.workspaceId === workspaceId);
  const canManageClients = membership?.role === 'owner' || membership?.role === 'coach';
  const isAdmin = principal?.platformRoles.includes('admin');

  return (
    <nav className="nav-bar px-3">
      <div className="nav-main">
        <NavLink to="/" className="nav-logo">LiftLog</NavLink>
        <div className="nav-links">
          <NavLink to="/">Programs</NavLink>
          <NavLink to="/library">Exercise Library</NavLink>
          {canManageClients && <NavLink to="/clients">Clients</NavLink>}
          {isAdmin && <NavLink to="/admin/users">Admin Users</NavLink>}
        </div>
        <div className="nav-session">
          {principal && principal.memberships.length > 1 && (
            <select aria-label="Workspace" value={workspaceId ?? ''} onChange={(event) => setWorkspaceId(event.target.value)}>
              {principal.memberships.filter((item) => item.status === 'active').map((item) => <option key={item.workspaceId} value={item.workspaceId}>{item.workspaceName}</option>)}
            </select>
          )}
          <span>{principal?.displayName} · {membership?.role ?? 'no role'}</span>
          <button className="btn btn-outline btn-sm" onClick={() => void logout()}>Log out</button>
        </div>
      </div>
      <div className="nav-info">{__APP_VERSION__} · {__BUILD_DATE__}</div>
    </nav>
  );
}
