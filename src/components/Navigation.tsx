import { useState, type KeyboardEvent } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import Offcanvas from 'react-bootstrap/Offcanvas';
import { useSession } from '../contexts/SessionContext';
import Icon, { type IconName } from './Icon';
import TestUserSwitcher from './TestUserSwitcher';
import { groupSpaces, spaceAccessLabel } from '../utils/spacePresentation';

export default function Navigation() {
  const { principal, workspaceId, setWorkspaceId, logout } = useSession();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const access = principal?.availableWorkspaces.find((item) => item.workspaceId === workspaceId);
  const canManage = principal?.platformRoles.includes('admin') || principal?.memberships.some(m => m.kind === 'organization' && ['owner', 'coach'].includes(m.role));
  const roleLabel = access ? spaceAccessLabel(access.kind, access.role, access.personalOwnerUserId === principal?.userId) : 'No space role';
  const spaceGroups = principal ? groupSpaces(principal.availableWorkspaces.filter(space => space.status === 'active'), principal.userId) : [];
  const isAdmin = principal?.platformRoles.includes('admin');
  const sections: { label: string; path: string; icon: IconName; show: boolean }[] = [
    { label: 'Programs', path: '/', icon: 'programs', show: true },
    { label: 'Exercise Library', path: '/library', icon: 'barbell', show: true },
    { label: 'Client assignments', path: '/clients', icon: 'users', show: Boolean(canManage) },
    { label: 'Spaces', path: '/workspaces', icon: 'workspace', show: Boolean(canManage) },
    { label: 'Admin Users', path: '/admin/users', icon: 'shield', show: Boolean(isAdmin) },
  ];
  const current = sections.find((s) => s.path !== '/' && pathname.startsWith(s.path))?.label ?? 'Training workspace';
  return <>
    <Offcanvas id="main-navigation-drawer" className="sidebar" responsive="md" show={open} onHide={() => setOpen(false)} aria-label="Navigation" onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
      if (!open || event.key !== 'Tab') return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter((element) => element.offsetParent !== null);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    }}>
      <button className="drawer-close icon-button" aria-label="Close navigation" onClick={() => setOpen(false)}><Icon name="close" /></button>
      <NavLink to="/" className="brand" onClick={() => setOpen(false)}><span className="brand-mark"><Icon name="barbell" /></span><span>LiftLog<span className="brand-period">.</span></span></NavLink>
      <p className="brand-description">A little structure.<br />A stronger you.</p>
      <nav aria-label="Main navigation" className="sidebar-nav">
        {sections.filter((s) => s.show).map((s) => <NavLink key={s.path} to={s.path} end={s.path === '/'} className={({ isActive }) => isActive || (s.path === '/' && pathname.startsWith('/programs/')) ? 'active' : ''} onClick={() => setOpen(false)}><Icon name={s.icon} />{s.label}</NavLink>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="workspace-caption"><span className="status-dot" />{__HOSTED__ ? 'Cloudflare workspace' : 'Local test workspace'}</div>
        <NavLink to="/about" className="about-link" onClick={() => setOpen(false)}><Icon name="info" /> About LiftLog</NavLink>
        <button className="logout-button" onClick={() => { void logout().catch((e: Error) => setError(e.message)); }}><Icon name="logout" />Log out</button>
        {error && <p role="alert">{error}</p>}
      </div>
    </Offcanvas>
    <header className="topbar">
      <button className="mobile-menu icon-button" aria-label="Open navigation" aria-controls="main-navigation-drawer" aria-expanded={open} onClick={() => setOpen(true)}><Icon name="menu" /></button>
      <div className="workspace-select"><span>{current}</span>{principal && principal.availableWorkspaces.length > 1 ? <select aria-label="Space" value={workspaceId ?? ''} onChange={(e) => { setWorkspaceId(e.target.value); navigate('/'); }}>{spaceGroups.filter(group => group.spaces.length).map(group => <optgroup label={group.label} key={group.key}>{group.spaces.map(space => <option key={space.workspaceId} value={space.workspaceId}>{space.workspaceName}</option>)}</optgroup>)}</select> : <strong>{access?.workspaceName ?? 'Choose a space'}</strong>}</div>
      <div className="account-strip"><span className="avatar">{principal?.displayName.split(' ').map((n) => n[0]).slice(0, 2).join('')}</span><div><strong>{principal?.displayName}</strong><span>{roleLabel}</span></div></div>
    </header>
    {principal?.testing?.canSwitch && <div className="test-session-bar"><div><span className="test-tag">Test mode</span><span>{principal.verifiedEmail}</span><small>{principal.testing.isImpersonating ? 'Simulated identity' : 'Account preview'}</small></div><TestUserSwitcher /></div>}
  </>;
}
