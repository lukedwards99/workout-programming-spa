import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types';
import { all, ApiError, audit, canReadProgram, data, first, newId, now, parseJson, requireWorkspaceRole } from '../lib';

export const trainingSessionRoutes = new Hono<AppEnv>();

trainingSessionRoutes.get('/workspaces/:workspaceId/programs/:programId/sessions', async (c) => {
  const principal = c.get('principal'); const { workspaceId, programId } = c.req.param();
  if (!await canReadProgram(c.env.DB, principal, workspaceId, programId)) throw new ApiError(403, 'forbidden', 'You cannot read these sessions.');
  const membership = requireWorkspaceRole(principal, workspaceId, ['owner', 'coach', 'client']);
  const rows = await all(c.env.DB.prepare(
    `SELECT ws.*, w.name AS workout_name, u.display_name AS athlete_name
     FROM workout_sessions ws JOIN workouts w ON w.id = ws.workout_id JOIN users u ON u.id = ws.athlete_user_id
     WHERE ws.workspace_id = ? AND ws.program_id = ? AND (? <> 'client' OR ws.athlete_user_id = ?)
     ORDER BY COALESCE(ws.scheduled_for, ws.created_at) DESC`,
  ).bind(workspaceId, programId, membership.role, principal.userId));
  return data(c, rows);
});

trainingSessionRoutes.post('/workspaces/:workspaceId/programs/:programId/workouts/:workoutId/sessions', async (c) => {
  const principal = c.get('principal'); const { workspaceId, programId, workoutId } = c.req.param();
  if (!await canReadProgram(c.env.DB, principal, workspaceId, programId)) throw new ApiError(403, 'forbidden', 'You cannot perform this workout.');
  requireWorkspaceRole(principal, workspaceId, ['owner', 'client']);
  const body = await parseJson(c, z.object({ scheduledFor: z.string().length(10).optional() }));
  const attempt = await first<{ next_attempt: number }>(c.env.DB.prepare(
    `SELECT COALESCE(MAX(attempt_number), 0) + 1 AS next_attempt FROM workout_sessions
     WHERE workspace_id = ? AND program_id = ? AND workout_id = ? AND athlete_user_id = ?`,
  ).bind(workspaceId, programId, workoutId, principal.userId));
  const id = newId(); const timestamp = now();
  await c.env.DB.prepare(
    `INSERT INTO workout_sessions
     (id, workspace_id, program_id, workout_id, athlete_user_id, attempt_number, status, scheduled_for,
      started_at, version, created_at, updated_at, updated_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, 'in_progress', ?, ?, 1, ?, ?, ?)`,
  ).bind(id, workspaceId, programId, workoutId, principal.userId, attempt?.next_attempt ?? 1, body.scheduledFor ?? null, timestamp, timestamp, timestamp, principal.userId).run();
  await audit(c.env.DB, principal.userId, 'workout_session.started', 'workout_session', id, { workspaceId, programId });
  return data(c, await first(c.env.DB.prepare('SELECT * FROM workout_sessions WHERE workspace_id = ? AND program_id = ? AND id = ?').bind(workspaceId, programId, id)), 201);
});

trainingSessionRoutes.get('/workspaces/:workspaceId/programs/:programId/sessions/:sessionId', async (c) => {
  const principal = c.get('principal'); const { workspaceId, programId, sessionId } = c.req.param();
  if (!await canReadProgram(c.env.DB, principal, workspaceId, programId)) throw new ApiError(403, 'forbidden', 'You cannot read this session.');
  const session = await first<Record<string, unknown>>(c.env.DB.prepare(
    'SELECT * FROM workout_sessions WHERE workspace_id = ? AND program_id = ? AND id = ?',
  ).bind(workspaceId, programId, sessionId));
  if (!session) throw new ApiError(404, 'not_found', 'Workout session not found.');
  const membership = requireWorkspaceRole(principal, workspaceId, ['owner', 'coach', 'client']);
  if (membership.role === 'client' && session.athlete_user_id !== principal.userId) throw new ApiError(403, 'forbidden', 'You can only read your own results.');
  const strengthResults = await all(c.env.DB.prepare('SELECT * FROM strength_set_results WHERE workspace_id = ? AND program_id = ? AND workout_session_id = ? ORDER BY created_at').bind(workspaceId, programId, sessionId));
  const cardioResults = await all(c.env.DB.prepare('SELECT * FROM cardio_set_results WHERE workspace_id = ? AND program_id = ? AND workout_session_id = ? ORDER BY created_at').bind(workspaceId, programId, sessionId));
  return data(c, { ...session, strength_results: strengthResults, cardio_results: cardioResults });
});

trainingSessionRoutes.patch('/workspaces/:workspaceId/programs/:programId/sessions/:sessionId', async (c) => {
  const principal = c.get('principal'); const { workspaceId, programId, sessionId } = c.req.param();
  const session = await first<{ athlete_user_id: string }>(c.env.DB.prepare(
    'SELECT athlete_user_id FROM workout_sessions WHERE workspace_id = ? AND program_id = ? AND id = ?',
  ).bind(workspaceId, programId, sessionId));
  if (!session) throw new ApiError(404, 'not_found', 'Workout session not found.');
  if (session.athlete_user_id !== principal.userId) throw new ApiError(403, 'forbidden', 'Only the athlete can update this session.');
  const body = await parseJson(c, z.object({
    status: z.enum(['in_progress', 'completed', 'skipped']), athleteNotes: z.string().max(4000).optional(), version: z.number().int().positive(),
  }));
  const result = await c.env.DB.prepare(
    `UPDATE workout_sessions SET status = ?, athlete_notes = ?, completed_at = ?, version = version + 1,
       updated_at = ?, updated_by_user_id = ? WHERE workspace_id = ? AND program_id = ? AND id = ? AND version = ?`,
  ).bind(body.status, body.athleteNotes || null, body.status === 'in_progress' ? null : now(), now(), principal.userId, workspaceId, programId, sessionId, body.version).run();
  if (!result.meta.changes) throw new ApiError(409, 'version_conflict', 'The workout session changed since it was loaded.');
  return data(c, await first(c.env.DB.prepare('SELECT * FROM workout_sessions WHERE workspace_id = ? AND program_id = ? AND id = ?').bind(workspaceId, programId, sessionId)));
});

const strengthResultInput = z.object({
  strengthSetId: z.string(), actualReps: z.number().int().nonnegative().nullable().optional(),
  actualWeight: z.number().nonnegative().nullable().optional(), actualRir: z.number().int().nonnegative().nullable().optional(),
  athleteNotes: z.string().max(2000).optional(), version: z.number().int().positive().optional(),
});

trainingSessionRoutes.put('/workspaces/:workspaceId/programs/:programId/sessions/:sessionId/strength-results', async (c) => {
  const principal = c.get('principal'); const { workspaceId, programId, sessionId } = c.req.param();
  const session = await first<{ athlete_user_id: string }>(c.env.DB.prepare('SELECT athlete_user_id FROM workout_sessions WHERE workspace_id = ? AND program_id = ? AND id = ?').bind(workspaceId, programId, sessionId));
  if (!session) throw new ApiError(404, 'not_found', 'Workout session not found.');
  if (session.athlete_user_id !== principal.userId) throw new ApiError(403, 'forbidden', 'Only the athlete can record results.');
  const body = await parseJson(c, strengthResultInput);
  const existing = await first<{ id: string; version: number }>(c.env.DB.prepare(
    'SELECT id, version FROM strength_set_results WHERE workspace_id = ? AND program_id = ? AND workout_session_id = ? AND strength_set_id = ?',
  ).bind(workspaceId, programId, sessionId, body.strengthSetId));
  if (existing && body.version !== existing.version) throw new ApiError(409, 'version_conflict', 'The result changed since it was loaded.');
  const timestamp = now();
  if (existing) {
    await c.env.DB.prepare(
      `UPDATE strength_set_results SET actual_reps = ?, actual_weight = ?, actual_rir = ?, athlete_notes = ?,
       version = version + 1, updated_at = ?, updated_by_user_id = ? WHERE workspace_id = ? AND program_id = ? AND id = ?`,
    ).bind(body.actualReps ?? null, body.actualWeight ?? null, body.actualRir ?? null, body.athleteNotes || null, timestamp, principal.userId, workspaceId, programId, existing.id).run();
    return data(c, await first(c.env.DB.prepare('SELECT * FROM strength_set_results WHERE workspace_id = ? AND program_id = ? AND id = ?').bind(workspaceId, programId, existing.id)));
  }
  const id = newId();
  await c.env.DB.prepare(
    `INSERT INTO strength_set_results
     (id, workspace_id, program_id, workout_session_id, strength_set_id, actual_reps, actual_weight, actual_rir,
      athlete_notes, version, created_at, updated_at, updated_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
  ).bind(id, workspaceId, programId, sessionId, body.strengthSetId, body.actualReps ?? null, body.actualWeight ?? null, body.actualRir ?? null, body.athleteNotes || null, timestamp, timestamp, principal.userId).run();
  return data(c, await first(c.env.DB.prepare('SELECT * FROM strength_set_results WHERE workspace_id = ? AND program_id = ? AND id = ?').bind(workspaceId, programId, id)), 201);
});

const cardioResultInput = z.object({
  cardioSetId: z.string(), actualDurationSeconds: z.number().int().nonnegative().nullable().optional(),
  actualDistance: z.number().nonnegative().nullable().optional(), actualRpe: z.number().int().min(1).max(10).nullable().optional(),
  athleteNotes: z.string().max(2000).optional(), version: z.number().int().positive().optional(),
});

trainingSessionRoutes.put('/workspaces/:workspaceId/programs/:programId/sessions/:sessionId/cardio-results', async (c) => {
  const principal = c.get('principal'); const { workspaceId, programId, sessionId } = c.req.param();
  const session = await first<{ athlete_user_id: string }>(c.env.DB.prepare('SELECT athlete_user_id FROM workout_sessions WHERE workspace_id = ? AND program_id = ? AND id = ?').bind(workspaceId, programId, sessionId));
  if (!session) throw new ApiError(404, 'not_found', 'Workout session not found.');
  if (session.athlete_user_id !== principal.userId) throw new ApiError(403, 'forbidden', 'Only the athlete can record results.');
  const body = await parseJson(c, cardioResultInput);
  const existing = await first<{ id: string; version: number }>(c.env.DB.prepare(
    'SELECT id, version FROM cardio_set_results WHERE workspace_id = ? AND program_id = ? AND workout_session_id = ? AND cardio_set_id = ?',
  ).bind(workspaceId, programId, sessionId, body.cardioSetId));
  if (existing && body.version !== existing.version) throw new ApiError(409, 'version_conflict', 'The result changed since it was loaded.');
  const timestamp = now();
  if (existing) {
    await c.env.DB.prepare(
      `UPDATE cardio_set_results SET actual_duration_seconds = ?, actual_distance = ?, actual_rpe = ?, athlete_notes = ?,
       version = version + 1, updated_at = ?, updated_by_user_id = ? WHERE workspace_id = ? AND program_id = ? AND id = ?`,
    ).bind(body.actualDurationSeconds ?? null, body.actualDistance ?? null, body.actualRpe ?? null, body.athleteNotes || null, timestamp, principal.userId, workspaceId, programId, existing.id).run();
    return data(c, await first(c.env.DB.prepare('SELECT * FROM cardio_set_results WHERE workspace_id = ? AND program_id = ? AND id = ?').bind(workspaceId, programId, existing.id)));
  }
  const id = newId();
  await c.env.DB.prepare(
    `INSERT INTO cardio_set_results
     (id, workspace_id, program_id, workout_session_id, cardio_set_id, actual_duration_seconds, actual_distance,
      actual_rpe, athlete_notes, version, created_at, updated_at, updated_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
  ).bind(id, workspaceId, programId, sessionId, body.cardioSetId, body.actualDurationSeconds ?? null, body.actualDistance ?? null, body.actualRpe ?? null, body.athleteNotes || null, timestamp, timestamp, principal.userId).run();
  return data(c, await first(c.env.DB.prepare('SELECT * FROM cardio_set_results WHERE workspace_id = ? AND program_id = ? AND id = ?').bind(workspaceId, programId, id)), 201);
});
