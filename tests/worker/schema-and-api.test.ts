import { beforeAll, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { applyD1Migrations, createExecutionContext } from 'cloudflare:test';
import worker from '../../worker/index';
import { resolveValidatedProviderIdentity } from '../../worker/provider-auth';

async function request(path: string, init?: RequestInit) {
  return worker.fetch(new Request(`http://test.local${path}`, init), env, createExecutionContext());
}

async function login(userId: string) {
  const response = await request('/api/local-auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  expect(response.status).toBe(200);
  return response.headers.get('set-cookie')?.split(';')[0] ?? '';
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  await applyD1Migrations(env.DB, env.TEST_SEEDS, 'local_seed_migrations');
});

describe('D1 catalog', () => {
  it('creates 21 base tables, 21 history tables, and 42 history triggers', async () => {
    const tables = await env.DB.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '_cf_%'
       AND name NOT IN ('d1_migrations', 'local_seed_migrations', 'sqlite_sequence')`,
    ).all<{ name: string }>();
    const names = tables.results.map((row) => row.name);
    expect(names.filter((name) => name.endsWith('_history'))).toHaveLength(21);
    expect(names.filter((name) => !name.endsWith('_history'))).toHaveLength(21);
    const triggers = await env.DB.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'trg_%_history_%'`,
    ).all();
    expect(triggers.results).toHaveLength(42);
  });

  it('keeps history tables free of foreign keys', async () => {
    const tables = await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '%_history'`).all<{ name: string }>();
    expect(tables.results).toHaveLength(21);
    for (const table of tables.results) {
      const result = await env.DB.prepare(`PRAGMA foreign_key_list(${table.name})`).all();
      expect(result.results, table.name).toEqual([]);
    }
  });

  it('puts the standard audit fields on every base table', async () => {
    const tables = await env.DB.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '%_history'
       AND name NOT LIKE '_cf_%' AND name NOT IN ('d1_migrations', 'local_seed_migrations', 'sqlite_sequence')`,
    ).all<{ name: string }>();
    for (const table of tables.results) {
      const columns = await env.DB.prepare(`PRAGMA table_info(${table.name})`).all<{ name: string }>();
      expect(columns.results.map((column) => column.name), table.name).toEqual(expect.arrayContaining(['created_at', 'updated_at', 'updated_by_user_id']));
    }
  });

  it('captures the old row and mutation actor before update and delete', async () => {
    await env.DB.prepare(
      `UPDATE programs SET name = 'Changed', updated_at = ?, updated_by_user_id = 'user-coach'
       WHERE id = 'program-local-template'`,
    ).bind(new Date().toISOString()).run();
    const update = await env.DB.prepare(
      `SELECT history_action, name, history_recorded_by_user_id FROM programs_history
       WHERE id = 'program-local-template' ORDER BY history_recorded_at DESC LIMIT 1`,
    ).first<{ history_action: string; name: string; history_recorded_by_user_id: string }>();
    expect(update).toMatchObject({
      history_action: 'UPDATE',
      name: 'Local Starter Program',
      history_recorded_by_user_id: 'user-coach',
    });
  });

  it('enforces legal holds and skips held history during retention', async () => {
    const cookie = await login('user-admin');
    const hold = await request('/api/admin/workspaces/workspace-local/legal-hold', {
      method: 'PATCH', headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, reason: 'Litigation test' }),
    });
    expect(hold.status).toBe(200);
    await expect(env.DB.prepare(`DELETE FROM workspaces WHERE id = 'workspace-local'`).run()).rejects.toThrow('workspace_legal_hold_active');
    const old = '2020-01-01T00:00:00.000Z';
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO programs_history (history_id, history_action, history_recorded_at, id, workspace_id) VALUES ('held-old', 'DELETE', ?, 'held-source', 'workspace-local')`).bind(old),
      env.DB.prepare(`INSERT INTO users_history (history_id, history_action, history_recorded_at, id) VALUES ('global-old', 'DELETE', ?, 'global-source')`).bind(old),
    ]);
    const retention = await request('/api/admin/maintenance/history-retention', { method: 'POST', headers: { Cookie: cookie } });
    expect(retention.status).toBe(200);
    expect(await env.DB.prepare(`SELECT 1 FROM programs_history WHERE history_id = 'held-old'`).first()).not.toBeNull();
    expect(await env.DB.prepare(`SELECT 1 FROM users_history WHERE history_id = 'global-old'`).first()).toBeNull();
  });
});

describe('local session and authorization', () => {
  it('exposes seeded local personas and returns the selected principal', async () => {
    const users = await request('/api/local-auth/users');
    expect(users.status).toBe(200);
    expect((await users.json() as { data: unknown[] }).data).toHaveLength(3);
    const cookie = await login('user-client');
    const session = await request('/api/session', { headers: { Cookie: cookie } });
    expect(session.status).toBe(200);
    expect((await session.json() as { data: { userId: string } }).data.userId).toBe('user-client');
  });

  it('prevents a client from creating a template', async () => {
    const cookie = await login('user-client');
    const response = await request('/api/workspaces/workspace-local/programs', {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Forbidden Template', kind: 'template' }),
    });
    expect(response.status).toBe(403);
  });

  it('allows a coach to read the shared workspace exercise library', async () => {
    const cookie = await login('user-coach');
    const response = await request('/api/workspaces/workspace-local/exercises', { headers: { Cookie: cookie } });
    expect(response.status).toBe(200);
    expect((await response.json() as { data: unknown[] }).data).toHaveLength(3);
  });

  it('rejects disabled and unknown local users', async () => {
    await env.DB.prepare(`UPDATE users SET status = 'disabled' WHERE id = 'user-client'`).run();
    expect((await request('/api/local-auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'user-client' }) })).status).toBe(401);
    expect((await request('/api/local-auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'missing' }) })).status).toBe(401);
    await env.DB.prepare(`UPDATE users SET status = 'active' WHERE id = 'user-client'`).run();
  });

  it('denies cross-workspace resource access', async () => {
    const timestamp = new Date().toISOString();
    await env.DB.prepare(`INSERT INTO workspaces (id, name, created_at, updated_at, updated_by_user_id) VALUES ('workspace-other', 'Other', ?, ?, 'user-admin')`).bind(timestamp, timestamp).run();
    const cookie = await login('user-coach');
    expect((await request('/api/workspaces/workspace-other/exercises', { headers: { Cookie: cookie } })).status).toBe(403);
  });

  it('links only a pre-created verified provider identity and rejects unknown users', async () => {
    const timestamp = new Date().toISOString();
    await env.DB.prepare(`INSERT INTO users (id, email_normalized, email_display, display_name, status, created_at, updated_at) VALUES ('user-invited-provider', 'invite@example.test', 'invite@example.test', 'Invited', 'invited', ?, ?)`).bind(timestamp, timestamp).run();
    const principal = await resolveValidatedProviderIdentity(env.DB, { provider: 'oidc', providerSubject: 'subject-1', verifiedEmail: 'Invite@Example.Test' });
    expect(principal.userId).toBe('user-invited-provider');
    expect(principal.provider).toBe('oidc');
    await expect(resolveValidatedProviderIdentity(env.DB, { provider: 'oidc', providerSubject: 'subject-2', verifiedEmail: 'unknown@example.test' })).rejects.toMatchObject({ code: 'unknown_provider_user' });
  });

  it('archives only completed programs and restores without reopening them', async () => {
    const cookie = await login('user-coach');
    const root = '/api/workspaces/workspace-local/programs/program-local-template';
    expect((await request(`${root}/archive`, { method: 'POST', headers: { Cookie: cookie } })).status).toBe(409);
    const update = await request(root, { method: 'PATCH', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Local Starter Program', notes: '', status: 'completed', revision: 1 }) });
    expect(update.status).toBe(200);
    expect((await request(`${root}/archive`, { method: 'POST', headers: { Cookie: cookie } })).status).toBe(200);
    const restored = await request(`${root}/restore`, { method: 'POST', headers: { Cookie: cookie } });
    expect(restored.status).toBe(200);
    expect((await restored.json() as { data: { status: string; visibility: string } }).data).toMatchObject({ status: 'completed', visibility: 'current' });
  });

  it('protects workspace library items that are in use', async () => {
    const timestamp = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO mesocycles (id, workspace_id, program_id, name, start_date, created_at, updated_at, updated_by_user_id) VALUES ('meso-use', 'workspace-local', 'program-local-template', 'Use', '2026-01-01', ?, ?, 'user-coach')`).bind(timestamp, timestamp),
      env.DB.prepare(`INSERT INTO workouts (id, workspace_id, program_id, mesocycle_id, name, day_offset, created_at, updated_at, updated_by_user_id) VALUES ('workout-use', 'workspace-local', 'program-local-template', 'meso-use', 'Use', 0, ?, ?, 'user-coach')`).bind(timestamp, timestamp),
      env.DB.prepare(`INSERT INTO workout_exercises (id, workspace_id, program_id, workout_id, exercise_id, exercise_order, created_at, updated_at, updated_by_user_id) VALUES ('block-use', 'workspace-local', 'program-local-template', 'workout-use', 'exercise-squat', 0, ?, ?, 'user-coach')`).bind(timestamp, timestamp),
    ]);
    const cookie = await login('user-coach');
    const response = await request('/api/workspaces/workspace-local/exercises/exercise-squat', { method: 'DELETE', headers: { Cookie: cookie } });
    expect(response.status).toBe(409);
  });

  it('copies assignments independently and permits direct coach edits', async () => {
    const timestamp = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO mesocycles (id, workspace_id, program_id, name, start_date, created_at, updated_at, updated_by_user_id) VALUES ('meso-copy', 'workspace-local', 'program-local-template', 'Copied Block', '2026-01-01', ?, ?, 'user-coach')`).bind(timestamp, timestamp),
      env.DB.prepare(`INSERT INTO workouts (id, workspace_id, program_id, mesocycle_id, name, day_offset, created_at, updated_at, updated_by_user_id) VALUES ('workout-copy', 'workspace-local', 'program-local-template', 'meso-copy', 'Copied Workout', 0, ?, ?, 'user-coach')`).bind(timestamp, timestamp),
    ]);
    const cookie = await login('user-coach');
    const assigned = await request('/api/workspaces/workspace-local/assignments', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceProgramId: 'program-local-template', clientUserId: 'user-client' }) });
    expect(assigned.status).toBe(201);
    const assignment = (await assigned.json() as { data: { assigned_program_id: string } }).data;
    const edit = await request(`/api/workspaces/workspace-local/programs/${assignment.assigned_program_id}`, { method: 'PATCH', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Client-specific edit', notes: '', status: 'active', revision: 1 }) });
    expect(edit.status).toBe(200);
    expect((await env.DB.prepare(`SELECT name FROM programs WHERE id = 'program-local-template'`).first<{ name: string }>())?.name).toBe('Local Starter Program');
    expect((await env.DB.prepare(`SELECT name FROM programs WHERE id = ?`).bind(assignment.assigned_program_id).first<{ name: string }>())?.name).toBe('Client-specific edit');
  });

  it('generates workouts and copies a program graph independently', async () => {
    const cookie = await login('user-coach');
    const mesocycleResponse = await request('/api/workspaces/workspace-local/programs/program-local-template/mesocycles', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Generated block', mesocycleLength: 7, startDate: '2026-02-01' }) });
    const mesocycleId = (await mesocycleResponse.json() as { data: { id: string } }).data.id;
    const generated = await request(`/api/workspaces/workspace-local/programs/program-local-template/mesocycles/${mesocycleId}/generate`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ workouts: [{ name: 'Day 1', dayOffset: 0 }, { name: 'Day 2', dayOffset: 2 }] }) });
    expect(generated.status).toBe(201);
    expect((await generated.json() as { data: unknown[] }).data).toHaveLength(2);
    const copied = await request('/api/workspaces/workspace-local/programs/program-local-template/copy', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Independent copy', kind: 'template' }) });
    expect(copied.status).toBe(201);
    const copyId = (await copied.json() as { data: { id: string } }).data.id;
    const sourceCount = (await env.DB.prepare('SELECT COUNT(*) AS count FROM workouts WHERE workspace_id = ? AND program_id = ?').bind('workspace-local', 'program-local-template').first<{ count: number }>())?.count;
    expect((await env.DB.prepare('SELECT COUNT(*) AS count FROM workouts WHERE workspace_id = ? AND program_id = ?').bind('workspace-local', copyId).first<{ count: number }>())?.count).toBe(sourceCount);
  });

  it('separates athlete results from coach plans and removes the complete client graph', async () => {
    const coachCookie = await login('user-coach');
    const assignedResponse = await request('/api/workspaces/workspace-local/assignments', { method: 'POST', headers: { Cookie: coachCookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceProgramId: 'program-local-template', clientUserId: 'user-client' }) });
    const programId = (await assignedResponse.json() as { data: { assigned_program_id: string } }).data.assigned_program_id;
    const mesocycleResponse = await request(`/api/workspaces/workspace-local/programs/${programId}/mesocycles`, { method: 'POST', headers: { Cookie: coachCookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Client block', mesocycleLength: 7, startDate: '2026-01-01' }) });
    const mesocycleId = (await mesocycleResponse.json() as { data: { id: string } }).data.id;
    const workoutResponse = await request(`/api/workspaces/workspace-local/programs/${programId}/mesocycles/${mesocycleId}/workouts`, { method: 'POST', headers: { Cookie: coachCookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Client workout', dayOffset: 0 }) });
    const workoutId = (await workoutResponse.json() as { data: { id: string } }).data.id;
    const blockResponse = await request(`/api/workspaces/workspace-local/programs/${programId}/workouts/${workoutId}/exercises`, { method: 'POST', headers: { Cookie: coachCookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ exerciseId: 'exercise-squat', exerciseOrder: 0 }) });
    const blockId = (await blockResponse.json() as { data: { id: string } }).data.id;
    const setResponse = await request(`/api/workspaces/workspace-local/programs/${programId}/workout-exercises/${blockId}/strength-sets`, { method: 'POST', headers: { Cookie: coachCookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ setNumber: 1, setType: 'normal', plannedReps: 5 }) });
    const setId = (await setResponse.json() as { data: { id: string } }).data.id;

    const clientCookie = await login('user-client');
    const sessionResponse = await request(`/api/workspaces/workspace-local/programs/${programId}/workouts/${workoutId}/sessions`, { method: 'POST', headers: { Cookie: clientCookie, 'Content-Type': 'application/json' }, body: '{}' });
    const sessionId = (await sessionResponse.json() as { data: { id: string } }).data.id;
    const resultPath = `/api/workspaces/workspace-local/programs/${programId}/sessions/${sessionId}/strength-results`;
    const createdResult = await request(resultPath, { method: 'PUT', headers: { Cookie: clientCookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ strengthSetId: setId, actualReps: 5, actualWeight: 100 }) });
    expect(createdResult.status).toBe(201);
    const createdVersion = (await createdResult.json() as { data: { version: number } }).data.version;
    expect((await request(resultPath, { method: 'PUT', headers: { Cookie: clientCookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ strengthSetId: setId, actualReps: 6, actualWeight: 105, version: createdVersion }) })).status).toBe(200);
    const resumed = await request(`/api/workspaces/workspace-local/programs/${programId}/sessions/${sessionId}`, { headers: { Cookie: clientCookie } });
    const resumedBody = await resumed.json() as { data: { strength_results: Array<{ actual_reps: number }> } };
    expect(resumedBody.data.strength_results).toHaveLength(1);
    expect(resumedBody.data.strength_results[0].actual_reps).toBe(6);
    expect((await request(resultPath, { method: 'PUT', headers: { Cookie: coachCookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ strengthSetId: setId, actualReps: 10 }) })).status).toBe(403);

    const ownerCookie = await login('user-admin');
    expect((await request('/api/workspaces/workspace-local/members/user-client', { method: 'DELETE', headers: { Cookie: ownerCookie } })).status).toBe(200);
    expect(await env.DB.prepare(`SELECT 1 FROM workspace_members WHERE workspace_id = 'workspace-local' AND user_id = 'user-client'`).first()).toBeNull();
    expect(await env.DB.prepare(`SELECT 1 FROM workout_sessions WHERE id = ?`).bind(sessionId).first()).toBeNull();
    expect(await env.DB.prepare(`SELECT 1 FROM programs WHERE id = ?`).bind(programId).first()).toBeNull();
    expect(await env.DB.prepare(`SELECT 1 FROM workout_sessions_history WHERE id = ? AND history_action = 'DELETE'`).bind(sessionId).first()).not.toBeNull();
    expect(await env.DB.prepare(`SELECT 1 FROM workspace_members_history WHERE user_id = 'user-client' AND history_action = 'DELETE'`).first()).not.toBeNull();
  });
});
