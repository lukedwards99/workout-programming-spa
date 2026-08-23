import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types';
import {
  all, ApiError, audit, canEditProgram, canReadProgram, data, deleteStatement, first,
  newId, now, parseJson, requireWorkspaceRole, stampStatement,
} from '../lib';

export const assignmentRoutes = new Hono<AppEnv>();

assignmentRoutes.get('/workspaces/:workspaceId/clients', async (c) => {
  const principal = c.get('principal'); const workspaceId = c.req.param('workspaceId');
  requireWorkspaceRole(principal, workspaceId, ['owner', 'coach']);
  const rows = await all(c.env.DB.prepare(
    `SELECT ccr.*, u.display_name, u.email_display, wm.status AS membership_status,
       (SELECT COUNT(*) FROM program_assignments pa WHERE pa.workspace_id = ccr.workspace_id
         AND pa.client_user_id = ccr.client_user_id AND pa.status = 'active') AS active_assignments
     FROM coach_client_relationships ccr
     JOIN users u ON u.id = ccr.client_user_id
     JOIN workspace_members wm ON wm.workspace_id = ccr.workspace_id AND wm.user_id = ccr.client_user_id
     WHERE ccr.workspace_id = ? AND (? = 'owner' OR ccr.coach_user_id = ?)
     ORDER BY u.display_name`,
  ).bind(workspaceId, requireWorkspaceRole(principal, workspaceId, ['owner', 'coach']).role, principal.userId));
  return data(c, rows);
});

assignmentRoutes.post('/workspaces/:workspaceId/clients', async (c) => {
  const principal = c.get('principal'); const workspaceId = c.req.param('workspaceId');
  requireWorkspaceRole(principal, workspaceId, ['owner', 'coach']);
  const body = await parseJson(c, z.object({ clientUserId: z.string(), coachUserId: z.string().optional() }));
  const coachUserId = body.coachUserId ?? principal.userId;
  const client = await first(c.env.DB.prepare(
    `SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND role = 'client' AND status = 'active'`,
  ).bind(workspaceId, body.clientUserId));
  if (!client) throw new ApiError(400, 'invalid_client', 'The selected user is not an active client in this workspace.');
  const id = newId(); const timestamp = now();
  await c.env.DB.prepare(
    `INSERT INTO coach_client_relationships
     (id, workspace_id, coach_user_id, client_user_id, status, created_at, updated_at, updated_by_user_id)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`,
  ).bind(id, workspaceId, coachUserId, body.clientUserId, timestamp, timestamp, principal.userId).run();
  return data(c, await first(c.env.DB.prepare('SELECT * FROM coach_client_relationships WHERE workspace_id = ? AND id = ?').bind(workspaceId, id)), 201);
});

assignmentRoutes.delete('/workspaces/:workspaceId/clients/:relationshipId', async (c) => {
  const principal = c.get('principal'); const { workspaceId, relationshipId } = c.req.param();
  requireWorkspaceRole(principal, workspaceId, ['owner', 'coach']);
  const relationship = await first<{ coach_user_id: string }>(c.env.DB.prepare(
    'SELECT coach_user_id FROM coach_client_relationships WHERE workspace_id = ? AND id = ?',
  ).bind(workspaceId, relationshipId));
  if (!relationship) throw new ApiError(404, 'not_found', 'Coach/client relationship not found.');
  const role = requireWorkspaceRole(principal, workspaceId, ['owner', 'coach']).role;
  if (role !== 'owner' && relationship.coach_user_id !== principal.userId) throw new ApiError(403, 'forbidden', 'You cannot remove another coach\'s relationship.');
  await c.env.DB.batch([
    stampStatement(c.env.DB, 'coach_client_relationships', 'workspace_id = ? AND id = ?', [workspaceId, relationshipId], principal.userId),
    deleteStatement(c.env.DB, 'coach_client_relationships', 'workspace_id = ? AND id = ?', [workspaceId, relationshipId]),
  ]);
  return data(c, { deleted: true });
});

assignmentRoutes.get('/workspaces/:workspaceId/assignments', async (c) => {
  const principal = c.get('principal'); const workspaceId = c.req.param('workspaceId');
  const membership = requireWorkspaceRole(principal, workspaceId, ['owner', 'coach', 'client']);
  const conditions = ['pa.workspace_id = ?']; const params: unknown[] = [workspaceId];
  if (!principal.platformRoles.includes('admin') && membership.role === 'coach') { conditions.push('pa.coach_user_id = ?'); params.push(principal.userId); }
  if (!principal.platformRoles.includes('admin') && membership.role === 'client') { conditions.push('pa.client_user_id = ?'); params.push(principal.userId); }
  return data(c, await all(c.env.DB.prepare(
    `SELECT pa.*, source.name AS source_program_name, assigned.name AS assigned_program_name,
       coach.display_name AS coach_name, client.display_name AS client_name
     FROM program_assignments pa
     LEFT JOIN programs source ON source.id = pa.source_program_id
     JOIN programs assigned ON assigned.id = pa.assigned_program_id
     JOIN users coach ON coach.id = pa.coach_user_id
     JOIN users client ON client.id = pa.client_user_id
     WHERE ${conditions.join(' AND ')} ORDER BY pa.assigned_at DESC`,
  ).bind(...params)));
});

assignmentRoutes.post('/workspaces/:workspaceId/assignments', async (c) => {
  const principal = c.get('principal'); const workspaceId = c.req.param('workspaceId');
  requireWorkspaceRole(principal, workspaceId, ['owner', 'coach']);
  const body = await parseJson(c, z.object({
    sourceProgramId: z.string(), clientUserId: z.string(), name: z.string().trim().min(1).optional(),
    startsOn: z.string().length(10).optional(), endsOn: z.string().length(10).optional(),
  }));
  if (!await canEditProgram(c.env.DB, principal, workspaceId, body.sourceProgramId)) {
    throw new ApiError(403, 'forbidden', 'You cannot assign this program.');
  }
  const source = await first<Record<string, unknown>>(c.env.DB.prepare(
    `SELECT * FROM programs WHERE workspace_id = ? AND id = ? AND kind = 'template'`,
  ).bind(workspaceId, body.sourceProgramId));
  if (!source) throw new ApiError(400, 'invalid_template', 'Assignments must be created from a template program.');
  const relationship = await first(c.env.DB.prepare(
    `SELECT 1 FROM coach_client_relationships WHERE workspace_id = ? AND coach_user_id = ?
       AND client_user_id = ? AND status = 'active'`,
  ).bind(workspaceId, principal.userId, body.clientUserId));
  if (!relationship && requireWorkspaceRole(principal, workspaceId, ['owner', 'coach']).role !== 'owner') {
    throw new ApiError(403, 'missing_relationship', 'An active coach/client relationship is required.');
  }
  const client = await first<{ display_name: string }>(c.env.DB.prepare(
    `SELECT u.display_name FROM workspace_members wm JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_id = ? AND wm.user_id = ? AND wm.role = 'client' AND wm.status = 'active'`,
  ).bind(workspaceId, body.clientUserId));
  if (!client) throw new ApiError(400, 'invalid_client', 'The selected client is not active.');

  const mesocycles = await all<Record<string, unknown>>(c.env.DB.prepare('SELECT * FROM mesocycles WHERE workspace_id = ? AND program_id = ?').bind(workspaceId, body.sourceProgramId));
  const workouts = await all<Record<string, unknown>>(c.env.DB.prepare('SELECT * FROM workouts WHERE workspace_id = ? AND program_id = ?').bind(workspaceId, body.sourceProgramId));
  const blocks = await all<Record<string, unknown>>(c.env.DB.prepare('SELECT * FROM workout_exercises WHERE workspace_id = ? AND program_id = ?').bind(workspaceId, body.sourceProgramId));
  const strengthSets = await all<Record<string, unknown>>(c.env.DB.prepare('SELECT * FROM strength_sets WHERE workspace_id = ? AND program_id = ?').bind(workspaceId, body.sourceProgramId));
  const cardioSets = await all<Record<string, unknown>>(c.env.DB.prepare('SELECT * FROM cardio_sets WHERE workspace_id = ? AND program_id = ?').bind(workspaceId, body.sourceProgramId));

  const assignedProgramId = newId(); const assignmentId = newId(); const timestamp = now();
  const mesocycleIds = new Map<string, string>(); const workoutIds = new Map<string, string>(); const blockIds = new Map<string, string>();
  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare(
      `INSERT INTO programs
       (id, workspace_id, owner_user_id, name, notes, kind, status, visibility, revision, created_at, updated_at, updated_by_user_id)
       VALUES (?, ?, ?, ?, ?, 'assigned', 'active', 'current', 1, ?, ?, ?)`,
    ).bind(assignedProgramId, workspaceId, principal.userId, body.name ?? `${String(source.name)} — ${client.display_name}`, source.notes ?? null, timestamp, timestamp, principal.userId),
    c.env.DB.prepare(
      `INSERT INTO program_members
       (workspace_id, program_id, user_id, access_level, created_at, updated_at, updated_by_user_id)
       VALUES (?, ?, ?, 'athlete', ?, ?, ?)`,
    ).bind(workspaceId, assignedProgramId, body.clientUserId, timestamp, timestamp, principal.userId),
    c.env.DB.prepare(
      `INSERT INTO program_assignments
       (id, workspace_id, source_program_id, assigned_program_id, coach_user_id, client_user_id,
        source_revision, status, starts_on, ends_on, assigned_at, created_at, updated_at, updated_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`,
    ).bind(assignmentId, workspaceId, body.sourceProgramId, assignedProgramId, principal.userId, body.clientUserId, source.revision, body.startsOn ?? null, body.endsOn ?? null, timestamp, timestamp, timestamp, principal.userId),
  ];

  for (const row of mesocycles) {
    const id = newId(); mesocycleIds.set(String(row.id), id);
    statements.push(c.env.DB.prepare(
      `INSERT INTO mesocycles
       (id, workspace_id, program_id, name, mesocycle_length, start_date, notes, sort_order, version, created_at, updated_at, updated_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    ).bind(id, workspaceId, assignedProgramId, row.name, row.mesocycle_length, row.start_date, row.notes, row.sort_order, timestamp, timestamp, principal.userId));
  }
  for (const row of workouts) {
    const id = newId(); workoutIds.set(String(row.id), id);
    statements.push(c.env.DB.prepare(
      `INSERT INTO workouts
       (id, workspace_id, program_id, mesocycle_id, name, day_offset, notes, sort_order, version, created_at, updated_at, updated_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    ).bind(id, workspaceId, assignedProgramId, mesocycleIds.get(String(row.mesocycle_id)), row.name, row.day_offset, row.notes, row.sort_order, timestamp, timestamp, principal.userId));
  }
  for (const row of blocks) {
    const id = newId(); blockIds.set(String(row.id), id);
    statements.push(c.env.DB.prepare(
      `INSERT INTO workout_exercises
       (id, workspace_id, program_id, workout_id, exercise_id, exercise_variation_id, exercise_order, version, created_at, updated_at, updated_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    ).bind(id, workspaceId, assignedProgramId, workoutIds.get(String(row.workout_id)), row.exercise_id, row.exercise_variation_id, row.exercise_order, timestamp, timestamp, principal.userId));
  }
  for (const row of strengthSets) {
    statements.push(c.env.DB.prepare(
      `INSERT INTO strength_sets
       (id, workspace_id, program_id, workout_exercise_id, set_number, set_type, planned_reps, planned_weight, target_rir, coach_notes, version, created_at, updated_at, updated_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    ).bind(newId(), workspaceId, assignedProgramId, blockIds.get(String(row.workout_exercise_id)), row.set_number, row.set_type, row.planned_reps, row.planned_weight, row.target_rir, row.coach_notes, timestamp, timestamp, principal.userId));
  }
  for (const row of cardioSets) {
    statements.push(c.env.DB.prepare(
      `INSERT INTO cardio_sets
       (id, workspace_id, program_id, workout_exercise_id, set_number, planned_duration_seconds, planned_distance, distance_unit, target_rpe, coach_notes, version, created_at, updated_at, updated_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    ).bind(newId(), workspaceId, assignedProgramId, blockIds.get(String(row.workout_exercise_id)), row.set_number, row.planned_duration_seconds, row.planned_distance, row.distance_unit, row.target_rpe, row.coach_notes, timestamp, timestamp, principal.userId));
  }
  await c.env.DB.batch(statements);
  await audit(c.env.DB, principal.userId, 'program.assigned', 'program_assignment', assignmentId, {
    workspaceId, programId: assignedProgramId, subjectUserId: body.clientUserId,
    metadata: { sourceProgramId: body.sourceProgramId, sourceRevision: source.revision },
  });
  return data(c, await first(c.env.DB.prepare('SELECT * FROM program_assignments WHERE workspace_id = ? AND id = ?').bind(workspaceId, assignmentId)), 201);
});

assignmentRoutes.patch('/workspaces/:workspaceId/assignments/:assignmentId', async (c) => {
  const principal = c.get('principal'); const workspaceId = c.req.param('workspaceId');
  requireWorkspaceRole(principal, workspaceId, ['owner', 'coach']);
  const body = await parseJson(c, z.object({ status: z.enum(['active', 'completed']), startsOn: z.string().length(10).nullable().optional(), endsOn: z.string().length(10).nullable().optional() }));
  await c.env.DB.prepare(
    `UPDATE program_assignments SET status = ?, starts_on = ?, ends_on = ?, completed_at = ?, updated_at = ?, updated_by_user_id = ?
     WHERE workspace_id = ? AND id = ? AND (coach_user_id = ? OR ? = 1)`,
  ).bind(body.status, body.startsOn ?? null, body.endsOn ?? null, body.status === 'completed' ? now() : null, now(), principal.userId, workspaceId, c.req.param('assignmentId'), principal.userId, principal.platformRoles.includes('admin') ? 1 : 0).run();
  return data(c, await first(c.env.DB.prepare('SELECT * FROM program_assignments WHERE workspace_id = ? AND id = ?').bind(workspaceId, c.req.param('assignmentId'))));
});

assignmentRoutes.delete('/workspaces/:workspaceId/assignments/:assignmentId', async (c) => {
  const principal = c.get('principal'); const { workspaceId, assignmentId } = c.req.param();
  const role = requireWorkspaceRole(principal, workspaceId, ['owner', 'coach']).role;
  const assignment = await first<{ coach_user_id: string; assigned_program_id: string }>(c.env.DB.prepare(
    'SELECT coach_user_id, assigned_program_id FROM program_assignments WHERE workspace_id = ? AND id = ?',
  ).bind(workspaceId, assignmentId));
  if (!assignment) throw new ApiError(404, 'not_found', 'Assignment not found.');
  if (role !== 'owner' && assignment.coach_user_id !== principal.userId) throw new ApiError(403, 'forbidden', 'You cannot delete another coach\'s assignment.');
  const programId = assignment.assigned_program_id;
  const statements = ([
    ['strength_set_results', 'workspace_id = ? AND program_id = ?'], ['cardio_set_results', 'workspace_id = ? AND program_id = ?'],
    ['workout_sessions', 'workspace_id = ? AND program_id = ?'], ['strength_sets', 'workspace_id = ? AND program_id = ?'],
    ['cardio_sets', 'workspace_id = ? AND program_id = ?'], ['workout_exercises', 'workspace_id = ? AND program_id = ?'],
    ['workouts', 'workspace_id = ? AND program_id = ?'], ['mesocycles', 'workspace_id = ? AND program_id = ?'],
    ['program_members', 'workspace_id = ? AND program_id = ?'], ['program_assignments', 'workspace_id = ? AND id = ?'],
    ['programs', 'workspace_id = ? AND id = ?'],
  ] as const).map(([table, where]) => stampStatement(
    c.env.DB,
    table,
    where,
    [workspaceId, table === 'program_assignments' ? assignmentId : programId],
    principal.userId,
  ));
  statements.push(
    deleteStatement(c.env.DB, 'strength_set_results', 'workspace_id = ? AND program_id = ?', [workspaceId, programId]),
    deleteStatement(c.env.DB, 'cardio_set_results', 'workspace_id = ? AND program_id = ?', [workspaceId, programId]),
    deleteStatement(c.env.DB, 'workout_sessions', 'workspace_id = ? AND program_id = ?', [workspaceId, programId]),
    deleteStatement(c.env.DB, 'programs', 'workspace_id = ? AND id = ?', [workspaceId, programId]),
  );
  await c.env.DB.batch(statements);
  await audit(c.env.DB, principal.userId, 'program.assignment.deleted', 'program_assignment', assignmentId, { workspaceId, programId });
  return data(c, { deleted: true });
});
