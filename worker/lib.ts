import type { Context } from 'hono';
import { z, type ZodType } from 'zod';
import type { AppEnv, AuthPrincipal } from './types';

export class ApiError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 500,
    public code: string,
    message: string,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export function data<T>(c: Context<AppEnv>, value: T, status: 200 | 201 = 200) {
  return c.json({ data: value }, status);
}

export async function parseJson<T>(c: Context<AppEnv>, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ApiError(400, 'invalid_json', 'The request body must be valid JSON.');
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ApiError(400, 'validation_error', 'The request was not valid.', z.flattenError(result.error).fieldErrors as Record<string, string[]>);
  }
  return result.data;
}

export function newId(): string {
  return crypto.randomUUID();
}

export function now(): string {
  return new Date().toISOString();
}

export async function first<T>(statement: D1PreparedStatement): Promise<T | null> {
  return (await statement.first<T>()) ?? null;
}

export async function all<T>(statement: D1PreparedStatement): Promise<T[]> {
  const result = await statement.all<T>();
  return result.results ?? [];
}

export function isPlatformAdmin(principal: AuthPrincipal): boolean {
  return principal.platformRoles.includes('admin');
}

export function membership(principal: AuthPrincipal, workspaceId: string) {
  return principal.memberships.find((item) => item.workspaceId === workspaceId && item.status === 'active');
}

export function requirePlatformAdmin(principal: AuthPrincipal): void {
  if (!isPlatformAdmin(principal)) throw new ApiError(403, 'forbidden', 'Platform administrator access is required.');
}

export function requireWorkspaceRole(
  principal: AuthPrincipal,
  workspaceId: string,
  roles: Array<'owner' | 'coach' | 'client'>,
) {
  if (isPlatformAdmin(principal)) return { role: 'owner' as const };
  const item = membership(principal, workspaceId);
  if (!item || !roles.includes(item.role)) throw new ApiError(403, 'forbidden', 'You do not have access to this workspace action.');
  return item;
}

export async function audit(
  db: D1Database,
  actorUserId: string | null,
  action: string,
  resourceType: string,
  resourceId: string | null,
  options: { workspaceId?: string | null; programId?: string | null; subjectUserId?: string | null; metadata?: unknown } = {},
) {
  const timestamp = now();
  await db.prepare(
    `INSERT INTO audit_events
       (id, workspace_id, program_id, actor_user_id, action, resource_type, resource_id,
        subject_user_id, metadata_json, created_at, updated_at, updated_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    newId(), options.workspaceId ?? null, options.programId ?? null, actorUserId,
    action, resourceType, resourceId, options.subjectUserId ?? null,
    options.metadata === undefined ? null : JSON.stringify(options.metadata),
    timestamp, timestamp, actorUserId,
  ).run();
}

const mutableTables = new Set([
  'users', 'auth_identities', 'platform_user_roles', 'workspaces', 'workspace_members',
  'coach_client_relationships', 'programs',
  'mesocycles', 'workouts', 'exercise_groups', 'exercises', 'exercise_variations',
  'workout_exercises', 'strength_sets', 'cardio_sets', 'audit_events',
]);

export function stampStatement(
  db: D1Database,
  table: string,
  whereSql: string,
  params: unknown[],
  actorUserId: string,
) {
  if (!mutableTables.has(table)) throw new Error(`Unsafe table name: ${table}`);
  return db.prepare(`UPDATE ${table} SET updated_at = ?, updated_by_user_id = ? WHERE ${whereSql}`)
    .bind(now(), actorUserId, ...params);
}

export function deleteStatement(db: D1Database, table: string, whereSql: string, params: unknown[]) {
  if (!mutableTables.has(table)) throw new Error(`Unsafe table name: ${table}`);
  return db.prepare(`DELETE FROM ${table} WHERE ${whereSql}`).bind(...params);
}

export async function canReadProgram(db: D1Database, principal: AuthPrincipal, workspaceId: string, programId: string) {
  if (isPlatformAdmin(principal)) return true;
  const workspace = membership(principal, workspaceId);
  if (!workspace) return false;
  if (workspace.role === 'owner') return true;
  const row = await first<{ allowed: number }>(db.prepare(
    `SELECT 1 AS allowed FROM programs p
     WHERE p.workspace_id = ? AND p.id = ? AND (
       p.owner_user_id = ? OR ( ? = 'coach' AND EXISTS (
         SELECT 1 FROM coach_client_relationships ccr
         WHERE ccr.workspace_id = p.workspace_id AND ccr.coach_user_id = ?
           AND ccr.client_user_id = p.owner_user_id AND ccr.status = 'active'
       ))
     )`,
  ).bind(workspaceId, programId, principal.userId, workspace.role, principal.userId));
  return Boolean(row);
}

export async function canEditProgramPlan(db: D1Database, principal: AuthPrincipal, workspaceId: string, programId: string) {
  if (isPlatformAdmin(principal)) return true;
  const workspace = membership(principal, workspaceId);
  if (!workspace || workspace.role === 'client') return false;
  if (workspace.role === 'owner') return true;
  const row = await first<{ allowed: number }>(db.prepare(
    `SELECT 1 AS allowed FROM programs p
     WHERE p.workspace_id = ? AND p.id = ? AND (
       p.owner_user_id = ? OR EXISTS (
         SELECT 1 FROM coach_client_relationships ccr
         WHERE ccr.workspace_id = p.workspace_id AND ccr.coach_user_id = ?
           AND ccr.client_user_id = p.owner_user_id AND ccr.status = 'active'
       )
     )`,
  ).bind(workspaceId, programId, principal.userId, principal.userId));
  return Boolean(row);
}

export async function canEditProgramExecution(db: D1Database, principal: AuthPrincipal, workspaceId: string, programId: string) {
  if (isPlatformAdmin(principal)) return true;
  const workspace = membership(principal, workspaceId);
  if (!workspace) return false;
  if (workspace.role === 'owner') return true;
  if (workspace.role !== 'client') return false;
  const row = await first<{ allowed: number }>(db.prepare(
    'SELECT 1 AS allowed FROM programs WHERE workspace_id = ? AND id = ? AND owner_user_id = ?',
  ).bind(workspaceId, programId, principal.userId));
  return Boolean(row);
}

export const canEditProgram = canEditProgramPlan;
