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
}

const SessionContext = createContext<SessionValue | null>(null);
const workspaceStorageKey = 'liftlog-workspace-id';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [principal, setPrincipal] = useState<AuthPrincipal | null>(null);
  const [workspaceId, setWorkspaceIdState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

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
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) applyPrincipal(null);
      else throw error;
    }
  }, [applyPrincipal]);

  useEffect(() => {
    const lost = () => applyPrincipal(null);
    window.addEventListener('liftlog-session-lost', lost);
    refresh().catch(console.error).finally(() => setReady(true));
    return () => window.removeEventListener('liftlog-session-lost', lost);
  }, [refresh, applyPrincipal]);

  const login = useCallback(async (userId: string) => {
    applyPrincipal(await sessionApi.login(userId));
  }, [applyPrincipal]);

  const logout = useCallback(async () => {
    if (__HOSTED__) {
      window.location.assign('/cdn-cgi/access/logout');
      return;
    }
    await sessionApi.logout();
    applyPrincipal(null);
  }, [applyPrincipal]);

  const setWorkspaceId = useCallback((next: string) => {
    if (!principal?.availableWorkspaces.some((item) => item.workspaceId === next && item.status === 'active')) return;
    window.localStorage.setItem(workspaceStorageKey, next);
    setWorkspaceIdState(next);
  }, [principal]);

  const value = useMemo(() => ({ principal, workspaceId, ready, setWorkspaceId, login, logout, refresh }), [principal, workspaceId, ready, setWorkspaceId, login, logout, refresh]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider.');
  return value;
}
