import { apiRequest, jsonBody } from './http';
import type { AuthPrincipal, LocalUser } from '../types/cloud';

export const sessionApi = {
  get(): Promise<AuthPrincipal> {
    return apiRequest('/session');
  },
  localUsers(): Promise<LocalUser[]> {
    return apiRequest('/local-auth/users');
  },
  login(userId: string): Promise<AuthPrincipal> {
    return apiRequest('/local-auth/session', { method: 'POST', ...jsonBody({ userId }) });
  },
  logout(): Promise<{ signedOut: boolean }> {
    return apiRequest('/session', { method: 'DELETE' });
  },
};

