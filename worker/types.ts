export interface WorkspaceMembership {
  workspaceId: string;
  workspaceName: string;
  role: 'owner' | 'coach' | 'client';
  status: 'active' | 'suspended';
}

export interface WorkspaceAccess {
  workspaceId: string;
  workspaceName: string;
  role: 'admin' | 'owner' | 'coach' | 'client';
  status: 'active' | 'suspended';
  isMember: boolean;
}

export interface AuthPrincipal {
  userId: string;
  displayName: string;
  verifiedEmail: string;
  provider: string;
  providerSubject: string;
  platformRoles: string[];
  memberships: WorkspaceMembership[];
  availableWorkspaces: WorkspaceAccess[];
}

export interface Bindings extends Omit<Cloudflare.Env, 'APP_ENV'> {
  APP_ENV: 'local' | 'test' | 'dev' | 'production';
}

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    principal: AuthPrincipal;
  };
};
