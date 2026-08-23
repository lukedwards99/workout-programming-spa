export interface WorkspaceMembership {
  workspaceId: string;
  workspaceName: string;
  role: 'owner' | 'coach' | 'client';
  status: 'active' | 'suspended';
}

export interface AuthPrincipal {
  userId: string;
  displayName: string;
  verifiedEmail: string;
  provider: string;
  providerSubject: string;
  platformRoles: string[];
  memberships: WorkspaceMembership[];
}

export interface Bindings {
  DB: D1Database;
  APP_ENV: 'local' | 'test' | 'preview' | 'production';
  LOCAL_AUTH_ENABLED: string;
}

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    principal: AuthPrincipal;
  };
};
