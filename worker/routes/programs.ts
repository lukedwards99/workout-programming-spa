import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types';
import {
  all, ApiError, audit, canEditProgram, canReadProgram, data, deleteStatement, first,
  newId, now, parseJson, requireWorkspaceRole, stampStatement,
} from '../lib';

export const programRoutes = new Hono<AppEnv>();

async function requireProgramRead(c: Parameters<typeof data>[0], workspaceId: string, programId: string) {
  if (!await canReadProgram(c.env.DB, c.get('principal'), workspaceId, programId)) {
    throw new ApiError(403, 'forbidden', 'You do not have access to this program.');
  }
}

async function requireProgramEdit(c: Parameters<typeof data>[0], workspaceId: string, programId: string) {
  if (!await canEditProgram(c.env.DB, c.get('principal'), workspaceId, programId)) {
    throw new ApiError(403, 'forbidden', 'You cannot edit this program.');
  }
}

programRoutes.get('/workspaces/:workspaceId/programs', async (c) => {
  const principal = c.get('principal');
  const workspaceId = c.req.param('workspaceId');
  const member = requireWorkspaceRole(principal, workspaceId, ['owner', 'coach', 'client']);
  const visibility = c.req.query('visibility') ?? 'current';
  const kind = c.req.query('kind');
  const clauses = ['p.workspace_id = ?', 'p.visibility = ?'];
  const params: unknown[] = [workspaceId, visibility];
  if (kind) { clauses.push('p.kind = ?'); params.push(kind); }
  if (!principal.platformRoles.includes('admin') && member.role !== 'owner') {
    clauses.push(`(
      p.owner_user_id = ? OR EXISTS (
        SELECT 1 FROM program_members pm WHERE pm.workspace_id = p.workspace_id AND pm.program_id = p.id AND pm.user_id = ?
      ) OR EXISTS (
        SELECT 1 FROM program_assignments pa WHERE pa.workspace_id = p.workspace_id AND pa.assigned_program_id = p.id
          AND (pa.coach_user_id = ? OR pa.client_user_id = ?)
      )
    )`);
    params.push(principal.userId, principal.userId, principal.userId, principal.userId);
  }
  const rows = await all(c.env.DB.prepare(
    `SELECT p.*, owner.display_name AS owner_name,
       pa.id AS assignment_id, pa.client_user_id, client.display_name AS client_name,
       pa.status AS assignment_status
     FROM programs p
     JOIN users owner ON owner.id = p.owner_user_id
     LEFT JOIN program_assignments pa ON pa.assigned_program_id = p.id
     LEFT JOIN users client ON client.id = pa.client_user_id
     WHERE ${clauses.join(' AND ')} ORDER BY p.updated_at DESC`,
  ).bind(...params));
  return data(c, rows);
});

programRoutes.post('/workspaces/:workspaceId/programs', async (c) => {
  const principal = c.get('principal');
  const workspaceId = c.req.param('workspaceId');
  requireWorkspaceRole(principal, workspaceId, ['owner', 'coach']);
  const body = await parseJson(c, z.object({
    name: z.string().trim().min(1).max(160), notes: z.string().max(4000).optional(),
    kind: z.enum(['personal', 'template']).default('personal'),
  }));
  const id = newId();
  const timestamp = now();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO programs
       (id, workspace_id, owner_user_id, name, notes, kind, status, visibility, revision,
        created_at, updated_at, updated_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', 'current', 1, ?, ?, ?)`,
    ).bind(id, workspaceId, principal.userId, body.name, body.notes || null, body.kind, timestamp, timestamp, principal.userId),
    c.env.DB.prepare(
      `INSERT INTO program_members
       (workspace_id, program_id, user_id, access_level, created_at, updated_at, updated_by_user_id)
       VALUES (?, ?, ?, 'editor', ?, ?, ?)`,
    ).bind(workspaceId, id, principal.userId, timestamp, timestamp, principal.userId),
  ]);
  await audit(c.env.DB, principal.userId, 'program.created', 'program', id, { workspaceId, programId: id });
  return data(c, await first(c.env.DB.prepare('SELECT * FROM programs WHERE workspace_id = ? AND id = ?').bind(workspaceId, id)), 201);
});

programRoutes.post('/workspaces/:workspaceId/programs/:programId/copy', async (c) => {
  const principal = c.get('principal'); const { workspaceId, programId } = c.req.param();
  await requireProgramRead(c, workspaceId, programId);
  requireWorkspaceRole(principal, workspaceId, ['owner', 'coach']);
  const body = await parseJson(c, z.object({ name: z.string().trim().min(1).max(160), kind: z.enum(['personal', 'template']).default('personal') }));
  const source = await first<Record<string, unknown>>(c.env.DB.prepare('SELECT * FROM programs WHERE workspace_id = ? AND id = ?').bind(workspaceId, programId));
  if (!source) throw new ApiError(404, 'not_found', 'Program not found.');
  const [mesocycles, workouts, blocks, strengthSets, cardioSets] = await Promise.all([
    all<Record<string, unknown>>(c.env.DB.prepare('SELECT * FROM mesocycles WHERE workspace_id = ? AND program_id = ?').bind(workspaceId, programId)),
    all<Record<string, unknown>>(c.env.DB.prepare('SELECT * FROM workouts WHERE workspace_id = ? AND program_id = ?').bind(workspaceId, programId)),
    all<Record<string, unknown>>(c.env.DB.prepare('SELECT * FROM workout_exercises WHERE workspace_id = ? AND program_id = ?').bind(workspaceId, programId)),
    all<Record<string, unknown>>(c.env.DB.prepare('SELECT * FROM strength_sets WHERE workspace_id = ? AND program_id = ?').bind(workspaceId, programId)),
    all<Record<string, unknown>>(c.env.DB.prepare('SELECT * FROM cardio_sets WHERE workspace_id = ? AND program_id = ?').bind(workspaceId, programId)),
  ]);
  const copyId = newId(); const timestamp = now(); const mesocycleIds = new Map<string, string>(); const workoutIds = new Map<string, string>(); const blockIds = new Map<string, string>();
  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare(`INSERT INTO programs
      (id, workspace_id, owner_user_id, name, notes, kind, status, visibility, revision, created_at, updated_at, updated_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, 'draft', 'current', 1, ?, ?, ?)`).bind(copyId, workspaceId, principal.userId, body.name, source.notes ?? null, body.kind, timestamp, timestamp, principal.userId),
    c.env.DB.prepare(`INSERT INTO program_members (workspace_id, program_id, user_id, access_level, created_at, updated_at, updated_by_user_id)
      VALUES (?, ?, ?, 'editor', ?, ?, ?)`).bind(workspaceId, copyId, principal.userId, timestamp, timestamp, principal.userId),
  ];
  for (const row of mesocycles) { const id = newId(); mesocycleIds.set(String(row.id), id); statements.push(c.env.DB.prepare(`INSERT INTO mesocycles (id, workspace_id, program_id, name, mesocycle_length, start_date, notes, sort_order, version, created_at, updated_at, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`).bind(id, workspaceId, copyId, row.name, row.mesocycle_length, row.start_date, row.notes, row.sort_order, timestamp, timestamp, principal.userId)); }
  for (const row of workouts) { const id = newId(); workoutIds.set(String(row.id), id); statements.push(c.env.DB.prepare(`INSERT INTO workouts (id, workspace_id, program_id, mesocycle_id, name, day_offset, notes, sort_order, version, created_at, updated_at, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`).bind(id, workspaceId, copyId, mesocycleIds.get(String(row.mesocycle_id)), row.name, row.day_offset, row.notes, row.sort_order, timestamp, timestamp, principal.userId)); }
  for (const row of blocks) { const id = newId(); blockIds.set(String(row.id), id); statements.push(c.env.DB.prepare(`INSERT INTO workout_exercises (id, workspace_id, program_id, workout_id, exercise_id, exercise_variation_id, exercise_order, version, created_at, updated_at, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`).bind(id, workspaceId, copyId, workoutIds.get(String(row.workout_id)), row.exercise_id, row.exercise_variation_id, row.exercise_order, timestamp, timestamp, principal.userId)); }
  for (const row of strengthSets) statements.push(c.env.DB.prepare(`INSERT INTO strength_sets (id, workspace_id, program_id, workout_exercise_id, set_number, set_type, planned_reps, planned_weight, target_rir, coach_notes, version, created_at, updated_at, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`).bind(newId(), workspaceId, copyId, blockIds.get(String(row.workout_exercise_id)), row.set_number, row.set_type, row.planned_reps, row.planned_weight, row.target_rir, row.coach_notes, timestamp, timestamp, principal.userId));
  for (const row of cardioSets) statements.push(c.env.DB.prepare(`INSERT INTO cardio_sets (id, workspace_id, program_id, workout_exercise_id, set_number, planned_duration_seconds, planned_distance, distance_unit, target_rpe, coach_notes, version, created_at, updated_at, updated_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`).bind(newId(), workspaceId, copyId, blockIds.get(String(row.workout_exercise_id)), row.set_number, row.planned_duration_seconds, row.planned_distance, row.distance_unit, row.target_rpe, row.coach_notes, timestamp, timestamp, principal.userId));
  await c.env.DB.batch(statements);
  await audit(c.env.DB, principal.userId, 'program.copied', 'program', copyId, { workspaceId, programId: copyId, metadata: { sourceProgramId: programId, sourceRevision: source.revision } });
  return data(c, await first(c.env.DB.prepare('SELECT * FROM programs WHERE workspace_id = ? AND id = ?').bind(workspaceId, copyId)), 201);
});

programRoutes.get('/workspaces/:workspaceId/programs/:programId', async (c) => {
  const workspaceId = c.req.param('workspaceId');
  const programId = c.req.param('programId');
  await requireProgramRead(c, workspaceId, programId);
  const row = await first(c.env.DB.prepare(
    `SELECT p.*, pa.id AS assignment_id, pa.client_user_id, pa.coach_user_id,
       pa.status AS assignment_status, client.display_name AS client_name
     FROM programs p LEFT JOIN program_assignments pa ON pa.assigned_program_id = p.id
     LEFT JOIN users client ON client.id = pa.client_user_id
     WHERE p.workspace_id = ? AND p.id = ?`,
  ).bind(workspaceId, programId));
  if (!row) throw new ApiError(404, 'not_found', 'Program not found.');
  return data(c, row);
});

programRoutes.patch('/workspaces/:workspaceId/programs/:programId', async (c) => {
  const principal = c.get('principal');
  const workspaceId = c.req.param('workspaceId');
  const programId = c.req.param('programId');
  await requireProgramEdit(c, workspaceId, programId);
  const body = await parseJson(c, z.object({
    name: z.string().trim().min(1).max(160), notes: z.string().max(4000).optional(),
    status: z.enum(['draft', 'active', 'completed']), revision: z.number().int().positive(),
  }));
  const result = await c.env.DB.prepare(
    `UPDATE programs SET name = ?, notes = ?, status = ?, revision = revision + 1,
       updated_at = ?, updated_by_user_id = ?
     WHERE workspace_id = ? AND id = ? AND revision = ?`,
  ).bind(body.name, body.notes || null, body.status, now(), principal.userId, workspaceId, programId, body.revision).run();
  if (!result.meta.changes) throw new ApiError(409, 'version_conflict', 'The program changed since it was loaded.');
  await audit(c.env.DB, principal.userId, 'program.updated', 'program', programId, { workspaceId, programId });
  return data(c, await first(c.env.DB.prepare('SELECT * FROM programs WHERE workspace_id = ? AND id = ?').bind(workspaceId, programId)));
});

programRoutes.post('/workspaces/:workspaceId/programs/:programId/archive', async (c) => {
  const principal = c.get('principal');
  const workspaceId = c.req.param('workspaceId');
  const programId = c.req.param('programId');
  await requireProgramEdit(c, workspaceId, programId);
  const result = await c.env.DB.prepare(
    `UPDATE programs SET visibility = 'archived', revision = revision + 1, updated_at = ?, updated_by_user_id = ?
     WHERE workspace_id = ? AND id = ? AND status = 'completed' AND visibility = 'current'`,
  ).bind(now(), principal.userId, workspaceId, programId).run();
  if (!result.meta.changes) throw new ApiError(409, 'archive_requires_completed', 'Only a completed current program can be archived.');
  return data(c, await first(c.env.DB.prepare('SELECT * FROM programs WHERE workspace_id = ? AND id = ?').bind(workspaceId, programId)));
});

programRoutes.post('/workspaces/:workspaceId/programs/:programId/restore', async (c) => {
  const principal = c.get('principal');
  const workspaceId = c.req.param('workspaceId');
  const programId = c.req.param('programId');
  await requireProgramEdit(c, workspaceId, programId);
  await c.env.DB.prepare(
    `UPDATE programs SET visibility = 'current', revision = revision + 1, updated_at = ?, updated_by_user_id = ?
     WHERE workspace_id = ? AND id = ? AND visibility = 'archived'`,
  ).bind(now(), principal.userId, workspaceId, programId).run();
  return data(c, await first(c.env.DB.prepare('SELECT * FROM programs WHERE workspace_id = ? AND id = ?').bind(workspaceId, programId)));
});

function prepareProgramDelete(db: D1Database, workspaceId: string, programId: string, actor: string) {
  return [
    stampStatement(db, 'strength_set_results', 'workspace_id = ? AND program_id = ?', [workspaceId, programId], actor),
    stampStatement(db, 'cardio_set_results', 'workspace_id = ? AND program_id = ?', [workspaceId, programId], actor),
    stampStatement(db, 'workout_sessions', 'workspace_id = ? AND program_id = ?', [workspaceId, programId], actor),
    stampStatement(db, 'strength_sets', 'workspace_id = ? AND program_id = ?', [workspaceId, programId], actor),
    stampStatement(db, 'cardio_sets', 'workspace_id = ? AND program_id = ?', [workspaceId, programId], actor),
    stampStatement(db, 'workout_exercises', 'workspace_id = ? AND program_id = ?', [workspaceId, programId], actor),
    stampStatement(db, 'workouts', 'workspace_id = ? AND program_id = ?', [workspaceId, programId], actor),
    stampStatement(db, 'mesocycles', 'workspace_id = ? AND program_id = ?', [workspaceId, programId], actor),
    stampStatement(db, 'program_members', 'workspace_id = ? AND program_id = ?', [workspaceId, programId], actor),
    stampStatement(db, 'program_assignments', 'workspace_id = ? AND (assigned_program_id = ? OR source_program_id = ?)', [workspaceId, programId, programId], actor),
    stampStatement(db, 'programs', 'workspace_id = ? AND id = ?', [workspaceId, programId], actor),
    deleteStatement(db, 'strength_set_results', 'workspace_id = ? AND program_id = ?', [workspaceId, programId]),
    deleteStatement(db, 'cardio_set_results', 'workspace_id = ? AND program_id = ?', [workspaceId, programId]),
    deleteStatement(db, 'workout_sessions', 'workspace_id = ? AND program_id = ?', [workspaceId, programId]),
    deleteStatement(db, 'programs', 'workspace_id = ? AND id = ?', [workspaceId, programId]),
  ];
}

programRoutes.delete('/workspaces/:workspaceId/programs/:programId', async (c) => {
  const principal = c.get('principal');
  const workspaceId = c.req.param('workspaceId');
  const programId = c.req.param('programId');
  await requireProgramEdit(c, workspaceId, programId);
  await c.env.DB.batch(prepareProgramDelete(c.env.DB, workspaceId, programId, principal.userId));
  await audit(c.env.DB, principal.userId, 'program.deleted', 'program', programId, { workspaceId, programId });
  return data(c, { deleted: true });
});

programRoutes.get('/workspaces/:workspaceId/programs/:programId/mesocycles', async (c) => {
  const { workspaceId, programId } = c.req.param();
  await requireProgramRead(c, workspaceId, programId);
  return data(c, await all(c.env.DB.prepare(
    `SELECT m.*, COUNT(w.id) AS workout_count FROM mesocycles m
     LEFT JOIN workouts w ON w.workspace_id = m.workspace_id AND w.program_id = m.program_id AND w.mesocycle_id = m.id
     WHERE m.workspace_id = ? AND m.program_id = ? GROUP BY m.id ORDER BY m.sort_order, m.start_date`,
  ).bind(workspaceId, programId)));
});

programRoutes.post('/workspaces/:workspaceId/programs/:programId/mesocycles', async (c) => {
  const principal = c.get('principal');
  const { workspaceId, programId } = c.req.param();
  await requireProgramEdit(c, workspaceId, programId);
  const body = await parseJson(c, z.object({
    name: z.string().trim().min(1).max(160), mesocycleLength: z.number().int().positive().default(7),
    startDate: z.string().min(10).max(10), notes: z.string().max(4000).optional(), sortOrder: z.number().int().default(0),
  }));
  const id = newId(); const timestamp = now();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO mesocycles
       (id, workspace_id, program_id, name, mesocycle_length, start_date, notes, sort_order, version, created_at, updated_at, updated_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    ).bind(id, workspaceId, programId, body.name, body.mesocycleLength, body.startDate, body.notes || null, body.sortOrder, timestamp, timestamp, principal.userId),
    c.env.DB.prepare(`UPDATE programs SET revision = revision + 1, updated_at = ?, updated_by_user_id = ? WHERE workspace_id = ? AND id = ?`).bind(timestamp, principal.userId, workspaceId, programId),
  ]);
  return data(c, await first(c.env.DB.prepare('SELECT * FROM mesocycles WHERE workspace_id = ? AND program_id = ? AND id = ?').bind(workspaceId, programId, id)), 201);
});

programRoutes.patch('/workspaces/:workspaceId/programs/:programId/mesocycles/:mesocycleId', async (c) => {
  const principal = c.get('principal'); const { workspaceId, programId, mesocycleId } = c.req.param();
  await requireProgramEdit(c, workspaceId, programId);
  const body = await parseJson(c, z.object({
    name: z.string().trim().min(1), mesocycleLength: z.number().int().positive(), startDate: z.string().length(10),
    notes: z.string().optional(), sortOrder: z.number().int().default(0), version: z.number().int().positive(),
  }));
  const result = await c.env.DB.prepare(
    `UPDATE mesocycles SET name = ?, mesocycle_length = ?, start_date = ?, notes = ?, sort_order = ?,
       version = version + 1, updated_at = ?, updated_by_user_id = ?
     WHERE workspace_id = ? AND program_id = ? AND id = ? AND version = ?`,
  ).bind(body.name, body.mesocycleLength, body.startDate, body.notes || null, body.sortOrder, now(), principal.userId, workspaceId, programId, mesocycleId, body.version).run();
  if (!result.meta.changes) throw new ApiError(409, 'version_conflict', 'The mesocycle changed since it was loaded.');
  return data(c, await first(c.env.DB.prepare('SELECT * FROM mesocycles WHERE workspace_id = ? AND program_id = ? AND id = ?').bind(workspaceId, programId, mesocycleId)));
});

programRoutes.delete('/workspaces/:workspaceId/programs/:programId/mesocycles/:mesocycleId', async (c) => {
  const principal = c.get('principal'); const { workspaceId, programId, mesocycleId } = c.req.param();
  await requireProgramEdit(c, workspaceId, programId);
  await c.env.DB.batch([
    stampStatement(c.env.DB, 'strength_sets', 'workspace_id = ? AND program_id = ? AND workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id IN (SELECT id FROM workouts WHERE mesocycle_id = ?))', [workspaceId, programId, mesocycleId], principal.userId),
    stampStatement(c.env.DB, 'cardio_sets', 'workspace_id = ? AND program_id = ? AND workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id IN (SELECT id FROM workouts WHERE mesocycle_id = ?))', [workspaceId, programId, mesocycleId], principal.userId),
    stampStatement(c.env.DB, 'workout_exercises', 'workspace_id = ? AND program_id = ? AND workout_id IN (SELECT id FROM workouts WHERE mesocycle_id = ?)', [workspaceId, programId, mesocycleId], principal.userId),
    stampStatement(c.env.DB, 'workouts', 'workspace_id = ? AND program_id = ? AND mesocycle_id = ?', [workspaceId, programId, mesocycleId], principal.userId),
    stampStatement(c.env.DB, 'mesocycles', 'workspace_id = ? AND program_id = ? AND id = ?', [workspaceId, programId, mesocycleId], principal.userId),
    deleteStatement(c.env.DB, 'mesocycles', 'workspace_id = ? AND program_id = ? AND id = ?', [workspaceId, programId, mesocycleId]),
  ]);
  return data(c, { deleted: true });
});

programRoutes.get('/workspaces/:workspaceId/programs/:programId/mesocycles/:mesocycleId/workouts', async (c) => {
  const { workspaceId, programId, mesocycleId } = c.req.param();
  await requireProgramRead(c, workspaceId, programId);
  return data(c, await all(c.env.DB.prepare(
    'SELECT * FROM workouts WHERE workspace_id = ? AND program_id = ? AND mesocycle_id = ? ORDER BY sort_order, day_offset, id',
  ).bind(workspaceId, programId, mesocycleId)));
});

programRoutes.post('/workspaces/:workspaceId/programs/:programId/mesocycles/:mesocycleId/workouts', async (c) => {
  const principal = c.get('principal'); const { workspaceId, programId, mesocycleId } = c.req.param();
  await requireProgramEdit(c, workspaceId, programId);
  const body = await parseJson(c, z.object({
    name: z.string().trim().min(1), dayOffset: z.number().int().nonnegative(), notes: z.string().optional(), sortOrder: z.number().int().default(0),
  }));
  const id = newId(); const timestamp = now();
  await c.env.DB.prepare(
    `INSERT INTO workouts
     (id, workspace_id, program_id, mesocycle_id, name, day_offset, notes, sort_order, version, created_at, updated_at, updated_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
  ).bind(id, workspaceId, programId, mesocycleId, body.name, body.dayOffset, body.notes || null, body.sortOrder, timestamp, timestamp, principal.userId).run();
  return data(c, await first(c.env.DB.prepare('SELECT * FROM workouts WHERE workspace_id = ? AND program_id = ? AND id = ?').bind(workspaceId, programId, id)), 201);
});

programRoutes.post('/workspaces/:workspaceId/programs/:programId/mesocycles/:mesocycleId/generate', async (c) => {
  const principal = c.get('principal'); const { workspaceId, programId, mesocycleId } = c.req.param();
  await requireProgramEdit(c, workspaceId, programId);
  const body = await parseJson(c, z.object({ workouts: z.array(z.object({ name: z.string().trim().min(1), dayOffset: z.number().int().nonnegative(), notes: z.string().max(4000).optional() })).min(1).max(30) }));
  const timestamp = now(); const ids: string[] = [];
  const statements = body.workouts.map((workout, index) => { const id = newId(); ids.push(id); return c.env.DB.prepare(`INSERT INTO workouts
    (id, workspace_id, program_id, mesocycle_id, name, day_offset, notes, sort_order, version, created_at, updated_at, updated_by_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`).bind(id, workspaceId, programId, mesocycleId, workout.name, workout.dayOffset, workout.notes ?? null, index, timestamp, timestamp, principal.userId); });
  statements.push(c.env.DB.prepare('UPDATE programs SET revision = revision + 1, updated_at = ?, updated_by_user_id = ? WHERE workspace_id = ? AND id = ?').bind(timestamp, principal.userId, workspaceId, programId));
  await c.env.DB.batch(statements);
  return data(c, await all(c.env.DB.prepare(`SELECT * FROM workouts WHERE workspace_id = ? AND program_id = ? AND id IN (${ids.map(() => '?').join(',')}) ORDER BY sort_order`).bind(workspaceId, programId, ...ids)), 201);
});

programRoutes.get('/workspaces/:workspaceId/programs/:programId/workouts/:workoutId', async (c) => {
  const { workspaceId, programId, workoutId } = c.req.param();
  await requireProgramRead(c, workspaceId, programId);
  const workout = await first(c.env.DB.prepare('SELECT * FROM workouts WHERE workspace_id = ? AND program_id = ? AND id = ?').bind(workspaceId, programId, workoutId));
  if (!workout) throw new ApiError(404, 'not_found', 'Workout not found.');
  const blocks = await all<Record<string, unknown>>(c.env.DB.prepare(
    `SELECT we.*, e.name AS exercise_name, e.notes AS exercise_notes, e.exercise_type,
       ev.name AS variation_name, eg.name AS group_name
     FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id
     JOIN exercise_groups eg ON eg.id = e.exercise_group_id
     LEFT JOIN exercise_variations ev ON ev.id = we.exercise_variation_id
     WHERE we.workspace_id = ? AND we.program_id = ? AND we.workout_id = ? ORDER BY we.exercise_order`,
  ).bind(workspaceId, programId, workoutId));
  for (const block of blocks) {
    const tableName = block.exercise_type === 'cardio' ? 'cardio_sets' : 'strength_sets';
    block.sets = await all(c.env.DB.prepare(
      `SELECT * FROM ${tableName} WHERE workspace_id = ? AND program_id = ? AND workout_exercise_id = ? ORDER BY set_number`,
    ).bind(workspaceId, programId, block.id));
  }
  return data(c, { ...workout as Record<string, unknown>, exercise_blocks: blocks });
});

programRoutes.patch('/workspaces/:workspaceId/programs/:programId/workouts/:workoutId', async (c) => {
  const principal = c.get('principal'); const { workspaceId, programId, workoutId } = c.req.param();
  await requireProgramEdit(c, workspaceId, programId);
  const body = await parseJson(c, z.object({
    name: z.string().trim().min(1), dayOffset: z.number().int().nonnegative(), notes: z.string().optional(),
    sortOrder: z.number().int().default(0), version: z.number().int().positive(),
  }));
  const result = await c.env.DB.prepare(
    `UPDATE workouts SET name = ?, day_offset = ?, notes = ?, sort_order = ?, version = version + 1,
       updated_at = ?, updated_by_user_id = ? WHERE workspace_id = ? AND program_id = ? AND id = ? AND version = ?`,
  ).bind(body.name, body.dayOffset, body.notes || null, body.sortOrder, now(), principal.userId, workspaceId, programId, workoutId, body.version).run();
  if (!result.meta.changes) throw new ApiError(409, 'version_conflict', 'The workout changed since it was loaded.');
  return data(c, await first(c.env.DB.prepare('SELECT * FROM workouts WHERE workspace_id = ? AND program_id = ? AND id = ?').bind(workspaceId, programId, workoutId)));
});

programRoutes.delete('/workspaces/:workspaceId/programs/:programId/workouts/:workoutId', async (c) => {
  const principal = c.get('principal'); const { workspaceId, programId, workoutId } = c.req.param();
  await requireProgramEdit(c, workspaceId, programId);
  await c.env.DB.batch([
    stampStatement(c.env.DB, 'strength_sets', 'workspace_id = ? AND program_id = ? AND workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id = ?)', [workspaceId, programId, workoutId], principal.userId),
    stampStatement(c.env.DB, 'cardio_sets', 'workspace_id = ? AND program_id = ? AND workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id = ?)', [workspaceId, programId, workoutId], principal.userId),
    stampStatement(c.env.DB, 'workout_exercises', 'workspace_id = ? AND program_id = ? AND workout_id = ?', [workspaceId, programId, workoutId], principal.userId),
    stampStatement(c.env.DB, 'workouts', 'workspace_id = ? AND program_id = ? AND id = ?', [workspaceId, programId, workoutId], principal.userId),
    deleteStatement(c.env.DB, 'workouts', 'workspace_id = ? AND program_id = ? AND id = ?', [workspaceId, programId, workoutId]),
  ]);
  return data(c, { deleted: true });
});

programRoutes.post('/workspaces/:workspaceId/programs/:programId/workouts/:workoutId/exercises', async (c) => {
  const principal = c.get('principal'); const { workspaceId, programId, workoutId } = c.req.param();
  await requireProgramEdit(c, workspaceId, programId);
  const body = await parseJson(c, z.object({
    exerciseId: z.string(), exerciseVariationId: z.string().nullable().optional(), exerciseOrder: z.number().int().nonnegative(),
  }));
  const id = newId(); const timestamp = now();
  await c.env.DB.prepare(
    `INSERT INTO workout_exercises
     (id, workspace_id, program_id, workout_id, exercise_id, exercise_variation_id, exercise_order, version, created_at, updated_at, updated_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
  ).bind(id, workspaceId, programId, workoutId, body.exerciseId, body.exerciseVariationId ?? null, body.exerciseOrder, timestamp, timestamp, principal.userId).run();
  return data(c, await first(c.env.DB.prepare('SELECT * FROM workout_exercises WHERE workspace_id = ? AND program_id = ? AND id = ?').bind(workspaceId, programId, id)), 201);
});

programRoutes.delete('/workspaces/:workspaceId/programs/:programId/workout-exercises/:blockId', async (c) => {
  const principal = c.get('principal'); const { workspaceId, programId, blockId } = c.req.param();
  await requireProgramEdit(c, workspaceId, programId);
  await c.env.DB.batch([
    stampStatement(c.env.DB, 'strength_sets', 'workspace_id = ? AND program_id = ? AND workout_exercise_id = ?', [workspaceId, programId, blockId], principal.userId),
    stampStatement(c.env.DB, 'cardio_sets', 'workspace_id = ? AND program_id = ? AND workout_exercise_id = ?', [workspaceId, programId, blockId], principal.userId),
    stampStatement(c.env.DB, 'workout_exercises', 'workspace_id = ? AND program_id = ? AND id = ?', [workspaceId, programId, blockId], principal.userId),
    deleteStatement(c.env.DB, 'workout_exercises', 'workspace_id = ? AND program_id = ? AND id = ?', [workspaceId, programId, blockId]),
  ]);
  return data(c, { deleted: true });
});

const strengthSetInput = z.object({
  setNumber: z.number().int().positive(), setType: z.enum(['warmup', 'normal', 'dropset', 'failure', 'rest-pause']).default('normal'),
  plannedReps: z.number().int().nonnegative().nullable().optional(), plannedWeight: z.number().nonnegative().nullable().optional(),
  targetRir: z.number().int().nonnegative().nullable().optional(), coachNotes: z.string().optional(), version: z.number().int().positive().optional(),
});
const cardioSetInput = z.object({
  setNumber: z.number().int().positive(), plannedDurationSeconds: z.number().int().nonnegative().nullable().optional(),
  plannedDistance: z.number().nonnegative().nullable().optional(), distanceUnit: z.enum(['mi', 'km', 'm']).nullable().optional(),
  targetRpe: z.number().int().min(1).max(10).nullable().optional(), coachNotes: z.string().optional(), version: z.number().int().positive().optional(),
});

programRoutes.post('/workspaces/:workspaceId/programs/:programId/workout-exercises/:blockId/strength-sets', async (c) => {
  const principal = c.get('principal'); const { workspaceId, programId, blockId } = c.req.param();
  await requireProgramEdit(c, workspaceId, programId); const body = await parseJson(c, strengthSetInput);
  const id = newId(); const timestamp = now();
  await c.env.DB.prepare(
    `INSERT INTO strength_sets
     (id, workspace_id, program_id, workout_exercise_id, set_number, set_type, planned_reps, planned_weight, target_rir, coach_notes, version, created_at, updated_at, updated_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
  ).bind(id, workspaceId, programId, blockId, body.setNumber, body.setType, body.plannedReps ?? null, body.plannedWeight ?? null, body.targetRir ?? null, body.coachNotes || null, timestamp, timestamp, principal.userId).run();
  return data(c, await first(c.env.DB.prepare('SELECT * FROM strength_sets WHERE workspace_id = ? AND program_id = ? AND id = ?').bind(workspaceId, programId, id)), 201);
});

programRoutes.patch('/workspaces/:workspaceId/programs/:programId/strength-sets/:setId', async (c) => {
  const principal = c.get('principal'); const { workspaceId, programId, setId } = c.req.param();
  await requireProgramEdit(c, workspaceId, programId); const body = await parseJson(c, strengthSetInput.extend({ version: z.number().int().positive() }));
  const result = await c.env.DB.prepare(
    `UPDATE strength_sets SET set_number = ?, set_type = ?, planned_reps = ?, planned_weight = ?, target_rir = ?, coach_notes = ?,
       version = version + 1, updated_at = ?, updated_by_user_id = ?
     WHERE workspace_id = ? AND program_id = ? AND id = ? AND version = ?`,
  ).bind(body.setNumber, body.setType, body.plannedReps ?? null, body.plannedWeight ?? null, body.targetRir ?? null, body.coachNotes || null, now(), principal.userId, workspaceId, programId, setId, body.version).run();
  if (!result.meta.changes) throw new ApiError(409, 'version_conflict', 'The set changed since it was loaded.');
  return data(c, await first(c.env.DB.prepare('SELECT * FROM strength_sets WHERE workspace_id = ? AND program_id = ? AND id = ?').bind(workspaceId, programId, setId)));
});

programRoutes.post('/workspaces/:workspaceId/programs/:programId/workout-exercises/:blockId/cardio-sets', async (c) => {
  const principal = c.get('principal'); const { workspaceId, programId, blockId } = c.req.param();
  await requireProgramEdit(c, workspaceId, programId); const body = await parseJson(c, cardioSetInput);
  const id = newId(); const timestamp = now();
  await c.env.DB.prepare(
    `INSERT INTO cardio_sets
     (id, workspace_id, program_id, workout_exercise_id, set_number, planned_duration_seconds, planned_distance, distance_unit, target_rpe, coach_notes, version, created_at, updated_at, updated_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
  ).bind(id, workspaceId, programId, blockId, body.setNumber, body.plannedDurationSeconds ?? null, body.plannedDistance ?? null, body.distanceUnit ?? null, body.targetRpe ?? null, body.coachNotes || null, timestamp, timestamp, principal.userId).run();
  return data(c, await first(c.env.DB.prepare('SELECT * FROM cardio_sets WHERE workspace_id = ? AND program_id = ? AND id = ?').bind(workspaceId, programId, id)), 201);
});

programRoutes.patch('/workspaces/:workspaceId/programs/:programId/cardio-sets/:setId', async (c) => {
  const principal = c.get('principal'); const { workspaceId, programId, setId } = c.req.param();
  await requireProgramEdit(c, workspaceId, programId); const body = await parseJson(c, cardioSetInput.extend({ version: z.number().int().positive() }));
  const result = await c.env.DB.prepare(
    `UPDATE cardio_sets SET set_number = ?, planned_duration_seconds = ?, planned_distance = ?, distance_unit = ?, target_rpe = ?, coach_notes = ?,
       version = version + 1, updated_at = ?, updated_by_user_id = ?
     WHERE workspace_id = ? AND program_id = ? AND id = ? AND version = ?`,
  ).bind(body.setNumber, body.plannedDurationSeconds ?? null, body.plannedDistance ?? null, body.distanceUnit ?? null, body.targetRpe ?? null, body.coachNotes || null, now(), principal.userId, workspaceId, programId, setId, body.version).run();
  if (!result.meta.changes) throw new ApiError(409, 'version_conflict', 'The set changed since it was loaded.');
  return data(c, await first(c.env.DB.prepare('SELECT * FROM cardio_sets WHERE workspace_id = ? AND program_id = ? AND id = ?').bind(workspaceId, programId, setId)));
});

for (const [path, tableName] of [
  ['/workspaces/:workspaceId/programs/:programId/strength-sets/:setId', 'strength_sets'],
  ['/workspaces/:workspaceId/programs/:programId/cardio-sets/:setId', 'cardio_sets'],
] as const) {
  programRoutes.delete(path, async (c) => {
    const principal = c.get('principal'); const { workspaceId, programId, setId } = c.req.param();
    await requireProgramEdit(c, workspaceId, programId);
    await c.env.DB.batch([
      stampStatement(c.env.DB, tableName, 'workspace_id = ? AND program_id = ? AND id = ?', [workspaceId, programId, setId], principal.userId),
      deleteStatement(c.env.DB, tableName, 'workspace_id = ? AND program_id = ? AND id = ?', [workspaceId, programId, setId]),
    ]);
    return data(c, { deleted: true });
  });
}

programRoutes.get('/workspaces/:workspaceId/programs/:programId/summary', async (c) => {
  const { workspaceId, programId } = c.req.param(); await requireProgramRead(c, workspaceId, programId);
  const counts = await first(c.env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM mesocycles WHERE workspace_id = ? AND program_id = ?) AS mesocycles,
      (SELECT COUNT(*) FROM workouts WHERE workspace_id = ? AND program_id = ?) AS workouts,
      (SELECT COUNT(*) FROM workout_exercises WHERE workspace_id = ? AND program_id = ?) AS exercises,
      (SELECT COUNT(*) FROM strength_sets WHERE workspace_id = ? AND program_id = ?) +
      (SELECT COUNT(*) FROM cardio_sets WHERE workspace_id = ? AND program_id = ?) AS total_sets,
      (SELECT COUNT(*) FROM workout_sessions WHERE workspace_id = ? AND program_id = ? AND status = 'completed') AS completed_sessions`,
  ).bind(workspaceId, programId, workspaceId, programId, workspaceId, programId, workspaceId, programId, workspaceId, programId, workspaceId, programId));
  return data(c, counts);
});
