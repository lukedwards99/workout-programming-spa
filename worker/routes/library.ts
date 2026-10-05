import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types';
import { seedTestExercises, testExercisesEnabled } from '../test-exercises';
import {
  all, ApiError, audit, data, deleteStatement, first, newId, now, parseJson,
  requireWorkspaceRole, stampStatement,
} from '../lib';

export const libraryRoutes = new Hono<AppEnv>();

function requireLibraryRead(c: Parameters<typeof requireWorkspaceRole>[0], workspaceId: string) {
  return requireWorkspaceRole(c, workspaceId, ['owner', 'coach', 'client']);
}

function requireLibraryEdit(c: Parameters<typeof requireWorkspaceRole>[0], workspaceId: string) {
  return requireWorkspaceRole(c, workspaceId, ['owner', 'coach']);
}

libraryRoutes.post('/workspaces/:workspaceId/test-exercises', async (c) => {
  if (!testExercisesEnabled(c.env)) throw new ApiError(404, 'not_found', 'Test exercises are unavailable.');
  const principal = c.get('principal');
  const workspaceId = c.req.param('workspaceId');
  requireLibraryEdit(principal, workspaceId);
  return data(c, await seedTestExercises(c.env.DB, workspaceId, principal.userId));
});

libraryRoutes.get('/workspaces/:workspaceId/exercise-groups', async (c) => {
  const workspaceId = c.req.param('workspaceId');
  requireLibraryRead(c.get('principal'), workspaceId);
  const rows = await all(c.env.DB.prepare(
    `SELECT eg.*, COUNT(e.id) AS exercise_count
     FROM exercise_groups eg LEFT JOIN exercises e
       ON e.workspace_id = eg.workspace_id AND e.exercise_group_id = eg.id
     WHERE eg.workspace_id = ? GROUP BY eg.id ORDER BY eg.name`,
  ).bind(workspaceId));
  return data(c, rows);
});

libraryRoutes.post('/workspaces/:workspaceId/exercise-groups', async (c) => {
  const principal = c.get('principal');
  const workspaceId = c.req.param('workspaceId');
  requireLibraryEdit(principal, workspaceId);
  const body = await parseJson(c, z.object({ name: z.string().trim().min(1).max(120), notes: z.string().max(2000).optional() }));
  const id = newId();
  const timestamp = now();
  await c.env.DB.prepare(
    `INSERT INTO exercise_groups (id, workspace_id, name, notes, created_at, updated_at, updated_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, workspaceId, body.name, body.notes || null, timestamp, timestamp, principal.userId).run();
  await audit(c.env.DB, principal.userId, 'exercise_group.created', 'exercise_group', id, { workspaceId });
  return data(c, await first(c.env.DB.prepare('SELECT * FROM exercise_groups WHERE workspace_id = ? AND id = ?').bind(workspaceId, id)), 201);
});

libraryRoutes.patch('/workspaces/:workspaceId/exercise-groups/:groupId', async (c) => {
  const principal = c.get('principal');
  const workspaceId = c.req.param('workspaceId');
  requireLibraryEdit(principal, workspaceId);
  const body = await parseJson(c, z.object({ name: z.string().trim().min(1).max(120), notes: z.string().max(2000).optional() }));
  const result = await c.env.DB.prepare(
    `UPDATE exercise_groups SET name = ?, notes = ?, updated_at = ?, updated_by_user_id = ?
     WHERE workspace_id = ? AND id = ?`,
  ).bind(body.name, body.notes || null, now(), principal.userId, workspaceId, c.req.param('groupId')).run();
  if (!result.meta.changes) throw new ApiError(404, 'not_found', 'Exercise group not found.');
  return data(c, await first(c.env.DB.prepare('SELECT * FROM exercise_groups WHERE workspace_id = ? AND id = ?').bind(workspaceId, c.req.param('groupId'))));
});

libraryRoutes.delete('/workspaces/:workspaceId/exercise-groups/:groupId', async (c) => {
  const principal = c.get('principal');
  const workspaceId = c.req.param('workspaceId');
  const groupId = c.req.param('groupId');
  requireLibraryEdit(principal, workspaceId);
  const used = await first<{ count: number }>(c.env.DB.prepare(
    `SELECT COUNT(*) AS count FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id
     WHERE e.workspace_id = ? AND e.exercise_group_id = ?`,
  ).bind(workspaceId, groupId));
  if (used?.count) throw new ApiError(409, 'library_item_in_use', 'This group contains exercises used by a program.');
  await c.env.DB.batch([
    stampStatement(c.env.DB, 'exercise_variations', 'workspace_id = ? AND exercise_id IN (SELECT id FROM exercises WHERE workspace_id = ? AND exercise_group_id = ?)', [workspaceId, workspaceId, groupId], principal.userId),
    stampStatement(c.env.DB, 'exercises', 'workspace_id = ? AND exercise_group_id = ?', [workspaceId, groupId], principal.userId),
    stampStatement(c.env.DB, 'exercise_groups', 'workspace_id = ? AND id = ?', [workspaceId, groupId], principal.userId),
    deleteStatement(c.env.DB, 'exercise_groups', 'workspace_id = ? AND id = ?', [workspaceId, groupId]),
  ]);
  return data(c, { deleted: true });
});

libraryRoutes.get('/workspaces/:workspaceId/exercises', async (c) => {
  const workspaceId = c.req.param('workspaceId');
  requireLibraryRead(c.get('principal'), workspaceId);
  const groupId = c.req.query('groupId');
  const type = c.req.query('type');
  const search = c.req.query('search');
  const conditions = ['e.workspace_id = ?'];
  const params: unknown[] = [workspaceId];
  if (groupId) { conditions.push('e.exercise_group_id = ?'); params.push(groupId); }
  if (type) { conditions.push('e.exercise_type = ?'); params.push(type); }
  if (search) { conditions.push('e.name LIKE ?'); params.push(`%${search}%`); }
  const rows = await all(c.env.DB.prepare(
    `SELECT e.*, eg.name AS group_name,
       (SELECT COUNT(*) FROM workout_exercises we WHERE we.workspace_id = e.workspace_id AND we.exercise_id = e.id) AS usage_count
     FROM exercises e JOIN exercise_groups eg ON eg.id = e.exercise_group_id
     WHERE ${conditions.join(' AND ')} ORDER BY e.name`,
  ).bind(...params));
  return data(c, rows);
});

libraryRoutes.post('/workspaces/:workspaceId/exercises', async (c) => {
  const principal = c.get('principal');
  const workspaceId = c.req.param('workspaceId');
  requireLibraryEdit(principal, workspaceId);
  const body = await parseJson(c, z.object({
    exerciseGroupId: z.string(),
    name: z.string().trim().min(1).max(160),
    exerciseType: z.enum(['strength', 'cardio']).default('strength'),
    tutorialUrl: z.string().url().or(z.literal('')).optional(),
    notes: z.string().max(4000).optional(),
  }));
  const id = newId();
  const timestamp = now();
  await c.env.DB.prepare(
    `INSERT INTO exercises
     (id, workspace_id, exercise_group_id, name, exercise_type, tutorial_url, notes, version, created_at, updated_at, updated_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
  ).bind(id, workspaceId, body.exerciseGroupId, body.name, body.exerciseType, body.tutorialUrl || null, body.notes || null, timestamp, timestamp, principal.userId).run();
  return data(c, await first(c.env.DB.prepare('SELECT * FROM exercises WHERE workspace_id = ? AND id = ?').bind(workspaceId, id)), 201);
});

libraryRoutes.patch('/workspaces/:workspaceId/exercises/:exerciseId', async (c) => {
  const principal = c.get('principal');
  const workspaceId = c.req.param('workspaceId');
  requireLibraryEdit(principal, workspaceId);
  const body = await parseJson(c, z.object({
    exerciseGroupId: z.string(), name: z.string().trim().min(1).max(160),
    exerciseType: z.enum(['strength', 'cardio']), tutorialUrl: z.string().url().or(z.literal('')).optional(),
    notes: z.string().max(4000).optional(), version: z.number().int().positive(),
  }));
  const used = await first<{ count: number }>(c.env.DB.prepare(
    'SELECT COUNT(*) AS count FROM workout_exercises WHERE workspace_id = ? AND exercise_id = ?',
  ).bind(workspaceId, c.req.param('exerciseId')));
  const existing = await first<{ exercise_type: string }>(c.env.DB.prepare(
    'SELECT exercise_type FROM exercises WHERE workspace_id = ? AND id = ?',
  ).bind(workspaceId, c.req.param('exerciseId')));
  if (!existing) throw new ApiError(404, 'not_found', 'Exercise not found.');
  if (used?.count && existing.exercise_type !== body.exerciseType) {
    throw new ApiError(409, 'exercise_type_in_use', 'The type of a programmed exercise cannot be changed.');
  }
  const result = await c.env.DB.prepare(
    `UPDATE exercises SET exercise_group_id = ?, name = ?, exercise_type = ?, tutorial_url = ?, notes = ?,
       version = version + 1, updated_at = ?, updated_by_user_id = ?
     WHERE workspace_id = ? AND id = ? AND version = ?`,
  ).bind(body.exerciseGroupId, body.name, body.exerciseType, body.tutorialUrl || null, body.notes || null, now(), principal.userId, workspaceId, c.req.param('exerciseId'), body.version).run();
  if (!result.meta.changes) throw new ApiError(409, 'version_conflict', 'The exercise changed since it was loaded.');
  return data(c, await first(c.env.DB.prepare('SELECT * FROM exercises WHERE workspace_id = ? AND id = ?').bind(workspaceId, c.req.param('exerciseId'))));
});

libraryRoutes.delete('/workspaces/:workspaceId/exercises/:exerciseId', async (c) => {
  const principal = c.get('principal');
  const workspaceId = c.req.param('workspaceId');
  const exerciseId = c.req.param('exerciseId');
  requireLibraryEdit(principal, workspaceId);
  const used = await first<{ count: number }>(c.env.DB.prepare(
    'SELECT COUNT(*) AS count FROM workout_exercises WHERE workspace_id = ? AND exercise_id = ?',
  ).bind(workspaceId, exerciseId));
  if (used?.count) throw new ApiError(409, 'library_item_in_use', 'This exercise is used by a program.');
  await c.env.DB.batch([
    stampStatement(c.env.DB, 'exercise_variations', 'workspace_id = ? AND exercise_id = ?', [workspaceId, exerciseId], principal.userId),
    stampStatement(c.env.DB, 'exercises', 'workspace_id = ? AND id = ?', [workspaceId, exerciseId], principal.userId),
    deleteStatement(c.env.DB, 'exercises', 'workspace_id = ? AND id = ?', [workspaceId, exerciseId]),
  ]);
  return data(c, { deleted: true });
});

libraryRoutes.get('/workspaces/:workspaceId/exercises/:exerciseId/variations', async (c) => {
  const workspaceId = c.req.param('workspaceId');
  requireLibraryRead(c.get('principal'), workspaceId);
  return data(c, await all(c.env.DB.prepare(
    'SELECT * FROM exercise_variations WHERE workspace_id = ? AND exercise_id = ? ORDER BY is_primary DESC, name',
  ).bind(workspaceId, c.req.param('exerciseId'))));
});

libraryRoutes.post('/workspaces/:workspaceId/exercises/:exerciseId/variations', async (c) => {
  const principal = c.get('principal');
  const workspaceId = c.req.param('workspaceId');
  const exerciseId = c.req.param('exerciseId');
  requireLibraryEdit(principal, workspaceId);
  const body = await parseJson(c, z.object({
    name: z.string().trim().min(1).max(160), isPrimary: z.boolean().default(false),
    tutorialUrl: z.string().url().or(z.literal('')).optional(), notes: z.string().max(4000).optional(),
  }));
  const id = newId();
  const timestamp = now();
  const statements: D1PreparedStatement[] = [];
  if (body.isPrimary) {
    statements.push(c.env.DB.prepare(
      `UPDATE exercise_variations SET is_primary = 0, version = version + 1, updated_at = ?, updated_by_user_id = ?
       WHERE workspace_id = ? AND exercise_id = ?`,
    ).bind(timestamp, principal.userId, workspaceId, exerciseId));
  }
  statements.push(c.env.DB.prepare(
    `INSERT INTO exercise_variations
     (id, workspace_id, exercise_id, name, is_primary, tutorial_url, notes, version, created_at, updated_at, updated_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
  ).bind(id, workspaceId, exerciseId, body.name, body.isPrimary ? 1 : 0, body.tutorialUrl || null, body.notes || null, timestamp, timestamp, principal.userId));
  await c.env.DB.batch(statements);
  return data(c, await first(c.env.DB.prepare('SELECT * FROM exercise_variations WHERE workspace_id = ? AND exercise_id = ? AND id = ?').bind(workspaceId, exerciseId, id)), 201);
});

libraryRoutes.patch('/workspaces/:workspaceId/exercise-variations/:variationId', async (c) => {
  const principal = c.get('principal');
  const workspaceId = c.req.param('workspaceId');
  requireLibraryEdit(principal, workspaceId);
  const body = await parseJson(c, z.object({
    name: z.string().trim().min(1).max(160), isPrimary: z.boolean(),
    tutorialUrl: z.string().url().or(z.literal('')).optional(), notes: z.string().max(4000).optional(),
    version: z.number().int().positive(),
  }));
  const variation = await first<{ exercise_id: string }>(c.env.DB.prepare(
    'SELECT exercise_id FROM exercise_variations WHERE workspace_id = ? AND id = ?',
  ).bind(workspaceId, c.req.param('variationId')));
  if (!variation) throw new ApiError(404, 'not_found', 'Variation not found.');
  const statements: D1PreparedStatement[] = [];
  if (body.isPrimary) {
    statements.push(c.env.DB.prepare(
      `UPDATE exercise_variations SET is_primary = 0, version = version + 1, updated_at = ?, updated_by_user_id = ?
       WHERE workspace_id = ? AND exercise_id = ? AND id <> ?`,
    ).bind(now(), principal.userId, workspaceId, variation.exercise_id, c.req.param('variationId')));
  }
  statements.push(c.env.DB.prepare(
    `UPDATE exercise_variations SET name = ?, is_primary = ?, tutorial_url = ?, notes = ?,
       version = version + 1, updated_at = ?, updated_by_user_id = ?
     WHERE workspace_id = ? AND id = ? AND version = ?`,
  ).bind(body.name, body.isPrimary ? 1 : 0, body.tutorialUrl || null, body.notes || null, now(), principal.userId, workspaceId, c.req.param('variationId'), body.version));
  const results = await c.env.DB.batch(statements);
  if (!results.at(-1)?.meta.changes) throw new ApiError(409, 'version_conflict', 'The variation changed since it was loaded.');
  return data(c, await first(c.env.DB.prepare('SELECT * FROM exercise_variations WHERE workspace_id = ? AND id = ?').bind(workspaceId, c.req.param('variationId'))));
});

libraryRoutes.delete('/workspaces/:workspaceId/exercise-variations/:variationId', async (c) => {
  const principal = c.get('principal');
  const workspaceId = c.req.param('workspaceId');
  const variationId = c.req.param('variationId');
  requireLibraryEdit(principal, workspaceId);
  const used = await first<{ count: number }>(c.env.DB.prepare(
    'SELECT COUNT(*) AS count FROM workout_exercises WHERE workspace_id = ? AND exercise_variation_id = ?',
  ).bind(workspaceId, variationId));
  if (used?.count) throw new ApiError(409, 'library_item_in_use', 'This variation is used by a program.');
  await c.env.DB.batch([
    stampStatement(c.env.DB, 'exercise_variations', 'workspace_id = ? AND id = ?', [workspaceId, variationId], principal.userId),
    deleteStatement(c.env.DB, 'exercise_variations', 'workspace_id = ? AND id = ?', [workspaceId, variationId]),
  ]);
  return data(c, { deleted: true });
});
