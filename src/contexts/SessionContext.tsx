import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiClientError } from '../api/http';
import { sessionApi } from '../api/sessionApi';
import type { AuthPrincipal } from '../types/cloud';

interface SessionValue {
  principal: AuthPrincipal | null;
  workspaceId: string | null;
  ready: boolean;
  setWorkspaceId: (workspaceId: string) => void;
  login: (userId: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  switchUser: (userId: string) => Promise<void>;
  resetUser: () => Promise<void>;
  sessionError: string;
}

const SessionContext = createContext<SessionValue | null>(null);
const workspaceStorageKey = 'liftlog-workspace-id';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [principal, setPrincipal] = useState<AuthPrincipal | null>(null);
  const [workspaceId, setWorkspaceIdState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [sessionError, setSessionError] = useState('');

  const applyPrincipal = useCallback((next: AuthPrincipal | null) => {
    setPrincipal(next);
    if (!next) {
      setWorkspaceIdState(null);
      return;
    }
    const stored = window.localStorage.getItem(workspaceStorageKey);
    const selected = next.availableWorkspaces.find((item) => item.workspaceId === stored && item.status === 'active')
      ?? next.availableWorkspaces.find((item) => item.status === 'active')
      ?? null;
    setWorkspaceIdState(selected?.workspaceId ?? null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      applyPrincipal(await sessionApi.get());
      setSessionError('');
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) { applyPrincipal(null); setSessionError(''); }
      else throw error;
    }
  }, [applyPrincipal]);

  useEffect(() => {
    const lost = () => applyPrincipal(null);
    window.addEventListener('liftlog-session-lost', lost);
    refresh().catch((error: Error) => setSessionError(error.message)).finally(() => setReady(true));
    return () => window.removeEventListener('liftlog-session-lost', lost);
  }, [refresh, applyPrincipal]);

  useEffect(() => {
    if (!principal) return;
    const update = () => { if (document.visibilityState === 'visible') void refresh().catch(console.error); };
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => { window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update); };
  }, [principal?.userId, refresh]);

  const login = useCallback(async (userId: string) => {
    applyPrincipal(await sessionApi.login(userId));
    await refresh();
    window.localStorage.setItem('liftlog-session-change', crypto.randomUUID());
  }, [applyPrincipal, refresh]);

  const switchUser = useCallback(async (userId: string) => {
    applyPrincipal(await sessionApi.switchUser(userId));
    window.localStorage.setItem('liftlog-session-change', crypto.randomUUID());
  }, [applyPrincipal]);
  const resetUser = useCallback(async () => {
    await sessionApi.resetUser();
    await refresh();
    window.localStorage.setItem('liftlog-session-change', crypto.randomUUID());
  }, [refresh]);

  const logout = useCallback(async () => {
    await sessionApi.logout();
    window.localStorage.setItem('liftlog-session-change', crypto.randomUUID());
    if (__HOSTED__) {
      window.location.assign('/cdn-cgi/access/logout');
      return;
    }
    applyPrincipal(null);
  }, [applyPrincipal]);

  const setWorkspaceId = useCallback((next: string) => {
    if (!principal?.availableWorkspaces.some((item) => item.workspaceId === next && item.status === 'active')) return;
    window.localStorage.setItem(workspaceStorageKey, next);
    setWorkspaceIdState(next);
  }, [principal]);

  useEffect(() => {
    const changed = (e: StorageEvent) => {
      if (e.key === 'liftlog-session-change') void refresh().catch((error: Error) => setSessionError(error.message));
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [refresh]);

  const value = useMemo(() => ({ principal, workspaceId, ready, setWorkspaceId, login, logout, refresh, switchUser, resetUser, sessionError }), [principal, workspaceId, ready, setWorkspaceId, login, logout, refresh, switchUser, resetUser, sessionError]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider.');
  return value;
}
