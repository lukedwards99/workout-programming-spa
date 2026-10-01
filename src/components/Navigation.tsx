import { useState, type KeyboardEvent } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import Offcanvas from 'react-bootstrap/Offcanvas';
import { useSession } from '../contexts/SessionContext';
import Icon, { type IconName } from './Icon';
import TestUserSwitcher from './TestUserSwitcher';

export default function Navigation() {
  const { principal, workspaceId, setWorkspaceId, logout } = useSession();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const access = principal?.availableWorkspaces.find((item) => item.workspaceId === workspaceId);
  const canManage = ['owner', 'coach', 'admin'].includes(access?.role ?? '');
  const isAdmin = principal?.platformRoles.includes('admin');
  const sections: { label: string; path: string; icon: IconName; show: boolean }[] = [
    { label: 'Programs', path: '/', icon: 'programs', show: true },
    { label: 'Exercise Library', path: '/library', icon: 'barbell', show: true },
    { label: 'Clients', path: '/clients', icon: 'users', show: canManage },
    { label: 'Workspaces', path: '/workspaces', icon: 'workspace', show: true },
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
      <div className="workspace-select"><span>{current}</span>{principal && principal.availableWorkspaces.length > 1 ? <select aria-label="Workspace" value={workspaceId ?? ''} onChange={(e) => setWorkspaceId(e.target.value)}>{principal.availableWorkspaces.filter((w) => w.status === 'active').map((w) => <option key={w.workspaceId} value={w.workspaceId}>{w.workspaceName}</option>)}</select> : <strong>{access?.workspaceName ?? 'Choose a workspace'}</strong>}</div>
      <div className="account-strip"><span className="avatar">{principal?.displayName.split(' ').map((n) => n[0]).slice(0, 2).join('')}</span><div><strong>{principal?.displayName}</strong><span>{access?.role ?? 'No workspace role'}</span></div></div>
    </header>
    {principal?.testing?.canSwitch && <div className="test-session-bar"><div><span className="test-tag">Test mode</span><span>{principal.verifiedEmail}</span><small>{principal.testing.isImpersonating ? 'Simulated identity' : 'Account preview'}</small></div><TestUserSwitcher /></div>}
  </>;
}
