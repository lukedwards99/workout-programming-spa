export interface WorkspaceMembership {
  kind: 'organization' | 'personal' | 'client';
  clientUserId: string | null;
  personalOwnerUserId: string | null;
  parentWorkspaceId: string | null;
  workspaceId: string;
  workspaceName: string;
  role: 'owner' | 'coach' | 'client';
  status: 'active' | 'suspended';
}

export interface WorkspaceAccess extends Omit<WorkspaceMembership, 'role'> {
  role: 'admin' | 'owner' | 'coach' | 'client';
  isMember: boolean;
}

export interface AuthPrincipal {
  testing?: { canSwitch: boolean; authenticatedEmail: string; isImpersonating: boolean };
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
