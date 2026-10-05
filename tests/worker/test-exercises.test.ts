import { beforeAll, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { applyD1Migrations, createExecutionContext } from 'cloudflare:test';
import worker from '../../worker/index';
import type { Bindings } from '../../worker/types';

const data = async <T>(response: Response) => (await response.json() as { data: T }).data;
function call(path: string, userId = 'user-coach', method = 'GET', bindings: Bindings = env) {
  const ctx = createExecutionContext();
  if (['dev', 'production'].includes(bindings.APP_ENV)) {
    Object.defineProperty(ctx, 'access', { value: { getIdentity: async () => ({ email: 'admin@liftlog.local' }) } });
  }
  return worker.fetch(new Request(`http://test.local/api${path}`, {
    method, headers: { Cookie: `liftlog_local_user=${userId}` },
  }), bindings, ctx);
}
beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  await applyD1Migrations(env.DB, env.TEST_SEEDS, 'local_seed_migrations');
});
async function space() {
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO workspaces (id, name) VALUES (?, 'Test library')").bind(id).run();
  await env.DB.prepare("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, 'user-coach', 'coach')").bind(id).run();
  return id;
}

describe('development exercise library', () => {
  it('populates an empty space with usable exercises and variations, and safely repeats', async () => {
    const id = await space();
    const path = `/workspaces/${id}/test-exercises`;
    const response = await call(path, 'user-coach', 'POST');
    expect(response.status).toBe(200);
    expect(await data(response)).toEqual({ exercisesAdded: 12 });
    const rows = await data<Array<{ id: string; exercise_type: string }>>(await call(`/workspaces/${id}/exercises`));
    expect(rows).toHaveLength(12);
    expect(rows.filter(row => row.exercise_type === 'cardio')).toHaveLength(3);
    for (const row of rows) {
      expect(await data(await call(`/workspaces/${id}/exercises/${row.id}/variations`))).toEqual([
        expect.objectContaining({ workspace_id: id, exercise_id: row.id, is_primary: 1 }),
      ]);
    }
    await env.DB.prepare("UPDATE exercises SET name = 'My edited movement', notes = 'Keep this', version = 2 WHERE id = ?").bind(rows[0].id).run();
    await env.DB.prepare("UPDATE exercise_groups SET name = 'My strength exercises' WHERE workspace_id = ? AND name = 'Strength'").bind(id).run();
    await env.DB.prepare("UPDATE exercise_variations SET name = 'My variation' WHERE exercise_id = ?").bind(rows[0].id).run();
    const repeats = await Promise.all([call(path, 'user-coach', 'POST'), call(path, 'user-coach', 'POST')]);
    for (const repeat of repeats) expect(await data(repeat)).toEqual({ exercisesAdded: 0 });
    expect(await env.DB.prepare('SELECT name, notes, version FROM exercises WHERE id = ?').bind(rows[0].id).first()).toEqual({ name: 'My edited movement', notes: 'Keep this', version: 2 });
    expect(await env.DB.prepare('SELECT name FROM exercise_variations WHERE exercise_id = ?').bind(rows[0].id).first()).toEqual({ name: 'My variation' });
    const other = await space();
    expect(await data(await call(`/workspaces/${other}/exercises`))).toEqual([]);
    expect(await data(await call(`/workspaces/${other}/test-exercises`, 'user-coach', 'POST'))).toEqual({ exercisesAdded: 12 });
  });

  it('reuses existing groups and skips matching names without altering local exercises', async () => {
    const before = await env.DB.prepare("SELECT * FROM exercises WHERE workspace_id = 'workspace-local'").all();
    const response = await call('/workspaces/workspace-local/test-exercises', 'user-coach', 'POST');
    expect(response.status).toBe(200);
    expect(await data(response)).toEqual({ exercisesAdded: 5 });
    expect(await data(await call('/workspaces/workspace-local/exercise-groups'))).toHaveLength(2);
    for (const row of before.results) {
      expect(await env.DB.prepare('SELECT * FROM exercises WHERE id = ?').bind(row.id).first()).toEqual(row);
    }
  });

  it('enforces authentication and current space permissions', async () => {
    const id = await space();
    expect((await call(`/workspaces/${id}/test-exercises`, '', 'POST')).status).toBe(401);
    expect((await call(`/workspaces/${id}/test-exercises`, 'user-coach-two', 'POST')).status).toBe(403);
    expect((await call('/workspaces/client-space-user-client/test-exercises', 'user-client', 'POST')).status).toBe(403);
    expect((await call('/workspaces/client-space-user-client/test-exercises', 'user-coach', 'POST')).status).toBe(200);
  });

  it('supports hosted dev but disables both the control and endpoint in production', async () => {
    const id = await space();
    for (const environment of ['dev', 'production'] as const) {
      const bindings: Bindings = { ...env, APP_ENV: environment, LOCAL_AUTH_ENABLED: 'false' };
      const enabled = environment === 'dev';
      expect(await data(await call('/session/config', 'user-admin', 'GET', bindings))).toMatchObject({ testExercisesEnabled: enabled });
      expect((await call(`/workspaces/${id}/test-exercises`, 'user-admin', 'POST', bindings)).status).toBe(enabled ? 200 : 404);
    }
  });
});
