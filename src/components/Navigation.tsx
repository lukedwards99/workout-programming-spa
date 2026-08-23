import { NavLink } from 'react-router-dom';
import { useSession } from '../contexts/SessionContext';

export default function Navigation() {
  const { principal, workspaceId, setWorkspaceId, logout } = useSession();
  const access = principal?.availableWorkspaces.find((item) => item.workspaceId === workspaceId);
  const canManageClients = access?.role === 'owner' || access?.role === 'coach' || access?.role === 'admin';
  const isAdmin = principal?.platformRoles.includes('admin');
  const canManageWorkspaces = isAdmin || principal?.memberships.some((item) => item.status === 'active' && ['owner', 'coach'].includes(item.role));

  return (
    <nav className="nav-bar px-3">
      <div className="nav-main">
        <NavLink to="/" className="nav-logo">LiftLog</NavLink>
        <div className="nav-links">
          <NavLink to="/">Programs</NavLink>
          <NavLink to="/library">Exercise Library</NavLink>
          {canManageClients && <NavLink to="/clients">Clients</NavLink>}
          {canManageWorkspaces && <NavLink to="/workspaces">Workspaces</NavLink>}
          {isAdmin && <NavLink to="/admin/users">Admin Users</NavLink>}
        </div>
        <div className="nav-session">
          {principal && principal.availableWorkspaces.length > 1 && (
            <select aria-label="Workspace" value={workspaceId ?? ''} onChange={(event) => setWorkspaceId(event.target.value)}>
              {principal.availableWorkspaces.filter((item) => item.status === 'active').map((item) => <option key={item.workspaceId} value={item.workspaceId}>{item.workspaceName}</option>)}
            </select>
          )}
          <span>{principal?.displayName} · {access?.role ?? 'no role'}</span>
          <button className="btn btn-outline btn-sm" onClick={() => void logout()}>Log out</button>
        </div>
      </div>
      <div className="nav-info">{__APP_VERSION__} · {__BUILD_DATE__}</div>
    </nav>
  );
}
