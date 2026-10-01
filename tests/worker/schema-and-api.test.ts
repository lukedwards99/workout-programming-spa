import { beforeAll, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { applyD1Migrations, createExecutionContext } from 'cloudflare:test';
import worker from '../../worker/index';
import { resolveValidatedProviderIdentity } from '../../worker/provider-auth';

async function request(path: string, init?: RequestInit) { return worker.fetch(new Request(`http://test.local${path}`, init), env, createExecutionContext()); }
async function login(userId: string) { const response = await request('/api/local-auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }); expect(response.status).toBe(200); return response.headers.get('set-cookie')?.split(';')[0] ?? ''; }
const json = (cookie: string, body: unknown, method = 'POST'): RequestInit => ({ method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
async function dataOf<T>(response: Response) { return (await response.json() as { data: T }).data; }

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); await applyD1Migrations(env.DB, env.TEST_SEEDS, 'local_seed_migrations'); });

describe('simplified D1 catalog', () => {
  it('creates 16 base/history pairs and 32 history triggers', async () => {
    const tables = await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' AND name NOT IN ('d1_migrations','local_seed_migrations','sqlite_sequence')`).all<{ name: string }>();
    expect(tables.results.filter((row) => row.name.endsWith('_history'))).toHaveLength(16);
    expect(tables.results.filter((row) => !row.name.endsWith('_history') && row.name !== 'test_identity_sessions')).toHaveLength(16);
    expect((await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_%_history_%'`).all()).results).toHaveLength(32);
  });

  it('has audit fields on every base table and no history foreign keys', async () => {
    const tables = await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' AND name NOT IN ('d1_migrations','local_seed_migrations','sqlite_sequence')`).all<{ name: string }>();
    for (const { name } of tables.results) {
      if (name === 'test_identity_sessions') continue; // Ephemeral authentication state, outside the workout catalog.
      const foreignKeys = await env.DB.prepare(`PRAGMA foreign_key_list(${name})`).all();
      if (name.endsWith('_history')) expect(foreignKeys.results, name).toEqual([]);
      else expect((await env.DB.prepare(`PRAGMA table_info(${name})`).all<{ name: string }>()).results.map((row) => row.name), name).toEqual(expect.arrayContaining(['created_at', 'updated_at', 'updated_by_user_id']));
    }
  });

  it('contains only the direct programming tables and flattened execution columns', async () => {
    const names = (await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all<{ name: string }>()).results.map((row) => row.name);
    for (const removed of ['program_members', 'program_assignments', 'workout_sessions', 'strength_set_results', 'cardio_set_results']) expect(names).not.toContain(removed);
    const programColumns = (await env.DB.prepare('PRAGMA table_info(programs)').all<{ name: string }>()).results.map((row) => row.name);
    expect(programColumns).not.toEqual(expect.arrayContaining(['kind', 'status']));
    const strengthColumns = (await env.DB.prepare('PRAGMA table_info(strength_sets)').all<{ name: string }>()).results.map((row) => row.name);
    expect(strengthColumns).toEqual(expect.arrayContaining(['planned_reps', 'actual_reps', 'coach_notes', 'athlete_notes']));
  });

  it('captures old rows and the mutation actor', async () => {
    await env.DB.prepare(`UPDATE programs SET name='Changed once',updated_at=?,updated_by_user_id='user-coach' WHERE id='program-local'`).bind(new Date().toISOString()).run();
    const old = await env.DB.prepare(`SELECT history_action,name,history_recorded_by_user_id FROM programs_history WHERE id='program-local' ORDER BY history_recorded_at DESC LIMIT 1`).first();
    expect(old).toMatchObject({ history_action: 'UPDATE', name: 'Local Starter Program', history_recorded_by_user_id: 'user-coach' });
    await env.DB.prepare(`UPDATE programs SET name='Local Starter Program',updated_at=?,updated_by_user_id='user-coach' WHERE id='program-local'`).bind(new Date().toISOString()).run();
  });
});

describe('identity and workspace access', () => {
  it('exposes only the three seeded local personas', async () => { const response = await request('/api/local-auth/users'); expect(response.status).toBe(200); expect(await dataOf<unknown[]>(response)).toHaveLength(3); });
  it('links a provider only to a pre-created verified-email account', async () => { const t = new Date().toISOString(); await env.DB.prepare(`INSERT INTO users (id,email_normalized,email_display,display_name,status,created_at,updated_at) VALUES ('provider-user','invite@example.test','invite@example.test','Invited','invited',?,?)`).bind(t, t).run(); const principal = await resolveValidatedProviderIdentity(env.DB, { provider: 'oidc', providerSubject: 'subject-1', verifiedEmail: 'Invite@Example.Test' }); expect(principal.userId).toBe('provider-user'); await expect(resolveValidatedProviderIdentity(env.DB, { provider: 'oidc', providerSubject: 'subject-2', verifiedEmail: 'unknown@example.test' })).rejects.toMatchObject({ code: 'unknown_provider_user' }); });
  it('lets a coach create and switch workspaces while administrators see all active workspaces', async () => { const coach = await login('user-coach'); const created = await request('/api/workspaces', json(coach, { name: 'Coach Workspace' })); expect(created.status).toBe(201); const row = await dataOf<{ id: string }>(created); const session = await dataOf<{ availableWorkspaces: Array<{ workspaceId: string }> }>(await request('/api/session', { headers: { Cookie: coach } })); expect(session.availableWorkspaces.map((item) => item.workspaceId)).toContain(row.id); const admin = await login('user-admin'); const adminSession = await dataOf<{ availableWorkspaces: Array<{ workspaceId: string }> }>(await request('/api/session', { headers: { Cookie: admin } })); expect(adminSession.availableWorkspaces.map((item) => item.workspaceId)).toContain(row.id); const deleted = await request(`/api/workspaces/${row.id}`, json(coach, { confirmName: 'Coach Workspace' }, 'DELETE')); expect(deleted.status).toBe(200); expect(await env.DB.prepare('SELECT 1 FROM workspaces WHERE id=?').bind(row.id).first()).toBeNull(); expect(await env.DB.prepare(`SELECT 1 FROM workspaces_history WHERE id=? AND history_action='DELETE'`).bind(row.id).first()).not.toBeNull(); });
  it('denies cross-workspace access', async () => { const t = new Date().toISOString(); await env.DB.prepare(`INSERT INTO workspaces (id,name,created_at,updated_at,updated_by_user_id) VALUES ('isolated-space','Isolated',?,?,'user-admin')`).bind(t, t).run(); const coach = await login('user-coach'); expect((await request('/api/workspaces/isolated-space/exercises', { headers: { Cookie: coach } })).status).toBe(403); });
});

describe('direct sets and independent copies', () => {
  async function makeClientGraph() {
    const coach = await login('user-coach');
    const program = await dataOf<{ id: string }>(await request('/api/workspaces/workspace-local/programs', json(coach, { name: 'Client Strength', ownerUserId: 'user-client' })));
    const meso = await dataOf<{ id: string }>(await request(`/api/workspaces/workspace-local/programs/${program.id}/mesocycles`, json(coach, { name: 'Base', mesocycleLength: 7, startDate: '2026-01-01' })));
    const workout = await dataOf<{ id: string }>(await request(`/api/workspaces/workspace-local/programs/${program.id}/mesocycles/${meso.id}/workouts`, json(coach, { name: 'Day 1', dayOffset: 0 })));
    const block = await dataOf<{ id: string }>(await request(`/api/workspaces/workspace-local/programs/${program.id}/workouts/${workout.id}/exercises`, json(coach, { exerciseId: 'exercise-squat', exerciseOrder: 0 })));
    const set = await dataOf<{ id: string; version: number }>(await request(`/api/workspaces/workspace-local/programs/${program.id}/workout-exercises/${block.id}/strength-sets`, json(coach, { setNumber: 1, setType: 'normal', plannedReps: 5, plannedWeight: 100, targetRir: 2, coachNotes: 'Stay braced' })));
    return { coach, programId: program.id, mesoId: meso.id, workoutId: workout.id, setId: set.id, version: set.version };
  }

  it('splits plan and execution permissions with optimistic concurrency', async () => { const graph = await makeClientGraph(); const client = await login('user-client'); const execution = await request(`/api/workspaces/workspace-local/programs/${graph.programId}/strength-sets/${graph.setId}/execution`, json(client, { actualReps: 5, actualWeight: 105, actualRir: 1, athleteNotes: 'Solid', version: graph.version }, 'PATCH')); expect(execution.status).toBe(200); const version = (await dataOf<{ version: number }>(execution)).version; expect((await request(`/api/workspaces/workspace-local/programs/${graph.programId}/strength-sets/${graph.setId}/plan`, json(client, { setNumber: 1, setType: 'normal', plannedReps: 6, version }, 'PATCH'))).status).toBe(403); expect((await request(`/api/workspaces/workspace-local/programs/${graph.programId}/strength-sets/${graph.setId}/execution`, json(graph.coach, { actualReps: 6, version }, 'PATCH'))).status).toBe(403); expect((await request(`/api/workspaces/workspace-local/programs/${graph.programId}/strength-sets/${graph.setId}/execution`, json(client, { actualReps: 6, version: graph.version }, 'PATCH'))).status).toBe(409); });

  it('copies program graphs with executed values explicitly cleared or retained', async () => { const graph = await makeClientGraph(); const client = await login('user-client'); await request(`/api/workspaces/workspace-local/programs/${graph.programId}/strength-sets/${graph.setId}/execution`, json(client, { actualReps: 5, actualWeight: 105, actualRir: 1, athleteNotes: 'Copy check', version: graph.version }, 'PATCH')); const cleared = await dataOf<{ id: string }>(await request(`/api/workspaces/workspace-local/programs/${graph.programId}/copy`, json(graph.coach, { name: 'Cleared Copy', targetOwnerUserId: 'user-coach', includeExecutedValues: false }))); const exact = await dataOf<{ id: string }>(await request(`/api/workspaces/workspace-local/programs/${graph.programId}/copy`, json(graph.coach, { name: 'Exact Copy', targetOwnerUserId: 'user-coach', includeExecutedValues: true }))); const clearedSet = await env.DB.prepare('SELECT actual_reps,athlete_notes FROM strength_sets WHERE program_id=?').bind(cleared.id).first(); const exactSet = await env.DB.prepare('SELECT actual_reps,athlete_notes FROM strength_sets WHERE program_id=?').bind(exact.id).first(); expect(clearedSet).toMatchObject({ actual_reps: null, athlete_notes: null }); expect(exactSet).toMatchObject({ actual_reps: 5, athlete_notes: 'Copy check' }); });

  it('copies mesocycles and workouts and summarizes planned versus executed totals', async () => { const graph = await makeClientGraph(); const client = await login('user-client'); await request(`/api/workspaces/workspace-local/programs/${graph.programId}/strength-sets/${graph.setId}/execution`, json(client, { actualReps: 4, actualWeight: 110, actualRir: 1, version: graph.version }, 'PATCH')); const summary = await dataOf<{ strength: { planned_volume: number; actual_volume: number } }>(await request(`/api/workspaces/workspace-local/programs/${graph.programId}/mesocycles/${graph.mesoId}/summary`, { headers: { Cookie: graph.coach } })); expect(summary.strength).toMatchObject({ planned_volume: 500, actual_volume: 440 }); const target = await dataOf<{ id: string }>(await request('/api/workspaces/workspace-local/programs', json(graph.coach, { name: 'Destination' }))); const targetMeso = await dataOf<{ id: string }>(await request(`/api/workspaces/workspace-local/programs/${target.id}/mesocycles`, json(graph.coach, { name: 'Destination Cycle', startDate: '2026-02-01' }))); expect((await request(`/api/workspaces/workspace-local/programs/${graph.programId}/mesocycles/${graph.mesoId}/copy`, json(graph.coach, { targetProgramId: target.id, includeExecutedValues: false }))).status).toBe(201); expect((await request(`/api/workspaces/workspace-local/programs/${graph.programId}/workouts/${graph.workoutId}/copy`, json(graph.coach, { targetProgramId: target.id, targetMesocycleId: targetMeso.id, includeExecutedValues: true }))).status).toBe(201); });

  it('protects an in-use workspace exercise', async () => { const graph = await makeClientGraph(); expect((await request('/api/workspaces/workspace-local/exercises/exercise-squat', { method: 'DELETE', headers: { Cookie: graph.coach } })).status).toBe(409); });

  it('removes a client graph before permitting separate global-user deletion', async () => {
    const admin = await login('user-admin');
    expect((await request('/api/admin/users/user-client', { method: 'DELETE', headers: { Cookie: admin } })).status).toBe(409);
    expect((await request('/api/workspaces/workspace-local/members/user-client', { method: 'DELETE', headers: { Cookie: admin } })).status).toBe(200);
    expect(await env.DB.prepare(`SELECT 1 FROM workspace_members WHERE workspace_id='workspace-local' AND user_id='user-client'`).first()).toBeNull();
    expect(await env.DB.prepare(`SELECT 1 FROM programs WHERE workspace_id='workspace-local' AND owner_user_id='user-client'`).first()).toBeNull();
    expect(await env.DB.prepare(`SELECT 1 FROM users WHERE id='user-client'`).first()).not.toBeNull();
    expect(await env.DB.prepare(`SELECT 1 FROM workspace_members_history WHERE workspace_id='workspace-local' AND user_id='user-client' AND history_action='DELETE'`).first()).not.toBeNull();
    expect((await request('/api/admin/users/user-client', { method: 'DELETE', headers: { Cookie: admin } })).status).toBe(200);
    expect(await env.DB.prepare(`SELECT 1 FROM users WHERE id='user-client'`).first()).toBeNull();
  });
});
