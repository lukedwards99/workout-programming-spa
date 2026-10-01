import { beforeAll, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { applyD1Migrations, createExecutionContext } from 'cloudflare:test';
import worker from '../../worker/index';

const call = (path: string, cookie: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') => worker.fetch(new Request(`http://test.local/api${path}`, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env, createExecutionContext());
const data = async <T>(response: Response) => (await response.json() as {data:T}).data;
async function login(userId: string) { const response = await call('/local-auth/session','',{userId}); expect(response.status).toBe(200); return response.headers.get('set-cookie')!.split(';')[0]; }
beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); await applyD1Migrations(env.DB, env.TEST_SEEDS, 'local_seed_migrations'); });

async function fixture() {
  const f = await data<{workspaceId:string;ownerId:string;coachId:string;clientId:string;programId:string}>(await call('/testing/fixtures','',{label:'Assignments'}));
  const owner = await login(f.ownerId), coach = await login(f.coachId), client = await login(f.clientId);
  const other = await data<{id:string}>(await call('/admin/users',owner,{email:`other-${crypto.randomUUID()}@example.test`,displayName:'Other coach',status:'active',workspaceId:f.workspaceId,role:'coach'}));
  const second = await login(other.id);
  const space = `client-space-${f.clientId}`;
  const assignments = await data<Array<{relationship_id:string;client_user_id:string}>>(await call('/clients',coach));
  const relationship = assignments.find(a=>a.client_user_id===f.clientId)!.relationship_id;
  return {...f,owner,coach,client,second,otherId:other.id,space,relationship};
}

describe('client assignments and spaces', () => {
  it('provisions one client space and keeps the assignment directory staff-only', async () => {
    const f=await fixture();
    const session=await data<{availableWorkspaces:Array<{workspaceId:string;kind:string}>}>(await call('/session',f.client));
    expect(session.availableWorkspaces).toEqual([expect.objectContaining({workspaceId:f.space,kind:'client'})]);
    expect((await call('/clients',f.client)).status).toBe(403);
    expect((await call(`/workspaces/${f.workspaceId}/exercises`,f.client)).status).toBe(403);
    expect((await call('/workspaces',f.client,{name:'Second client space'})).status).toBe(403);
    expect((await call(`/workspaces/${f.space}/members`,f.owner,{userId:f.otherId,role:'owner'})).status).toBe(409);
    expect((await call(`/workspaces/${f.space}`,f.owner,{confirmName:'Assignments Client’s space'},'DELETE')).status).toBe(409);
    expect((await env.DB.prepare('SELECT id FROM workspaces WHERE client_user_id=?').bind(f.clientId).all()).results).toHaveLength(1);
  });

  it('allows only the assigned coach to enter the space and revokes access on release', async () => {
    const f=await fixture();
    expect((await call(`/workspaces/${f.space}/programs`,f.coach,{name:'Client plan'})).status).toBe(201);
    expect((await call(`/workspaces/${f.space}/programs`,f.second)).status).toBe(403);
    expect((await call(`/clients/${f.clientId}/release`,f.second,{relationshipId:f.relationship})).status).toBe(403);
    expect((await call(`/clients/${f.clientId}/claim`,f.second,{})).status).toBe(409);
    expect((await call(`/clients/${f.clientId}/release`,f.coach,{relationshipId:f.relationship})).status).toBe(200);
    expect((await call(`/workspaces/${f.space}/exercises`,f.coach)).status).toBe(403);
    expect((await call(`/workspaces/${f.space}/programs`,f.coach,{name:'Forbidden after release'})).status).toBe(403);
    expect((await call(`/workspaces/${f.space}/programs`,f.client)).status).toBe(200);
    expect((await call(`/clients/${f.clientId}/claim`,f.second,{})).status).toBe(201);
    expect((await call(`/workspaces/${f.space}/exercises`,f.second)).status).toBe(200);
    expect((await call(`/clients/${f.clientId}/release`,f.owner,{relationshipId:f.relationship})).status).toBe(409);
    expect((await call(`/workspaces/${f.space}/members/${f.clientId}`,f.owner,{role:'coach'},'PATCH')).status).toBe(409);
  });

  it('lets owners force release, validates coach targets, and safely handles competing claims', async () => {
    const f=await fixture();
    await env.DB.prepare('DELETE FROM platform_user_roles WHERE user_id=?').bind(f.ownerId).run(); // Test a real organization owner, without admin override.
    expect((await call(`/clients/${f.clientId}/release`,f.owner,{relationshipId:f.relationship})).status).toBe(200);
    expect((await call(`/clients/${f.clientId}/claim`,f.owner,{coachUserId:f.clientId})).status).toBe(400);
    expect((await call(`/clients/${f.clientId}/claim`,f.coach,{coachUserId:f.otherId})).status).toBe(403);
    const claims=await Promise.all([call(`/clients/${f.clientId}/claim`,f.coach,{}),call(`/clients/${f.clientId}/claim`,f.second,{})]);
    expect(claims.map(r=>r.status).sort()).toEqual([201,409]);
    expect((await env.DB.prepare("SELECT id FROM coach_client_relationships WHERE client_user_id=? AND status='active'").bind(f.clientId).all()).results).toHaveLength(1);
    expect((await call(`/clients/${f.clientId}/claim`,await login('user-coach'),{})).status).toBe(403);
  });

  it('preserves data when releasing, and isolates library copies and personal spaces', async () => {
    const f=await fixture();
    const cycle=await data<{id:string}>(await call(`/workspaces/${f.workspaceId}/programs/${f.programId}/mesocycles`,f.coach,{name:'Base',startDate:'2026-09-30'}));
    const workout=await data<{id:string}>(await call(`/workspaces/${f.workspaceId}/programs/${f.programId}/mesocycles/${cycle.id}/workouts`,f.coach,{name:'Day one',dayOffset:0}));
    const original=await env.DB.prepare('SELECT id FROM exercises WHERE workspace_id=?').bind(f.workspaceId).first<{id:string}>();
    await call(`/workspaces/${f.workspaceId}/programs/${f.programId}/workouts/${workout.id}/exercises`,f.coach,{exerciseId:original!.id,exerciseOrder:0});
    const copy=await data<{id:string}>(await call(`/workspaces/${f.workspaceId}/programs/${f.programId}/copy`,f.coach,{name:'Client copy',targetWorkspaceId:f.space,targetOwnerUserId:f.clientId,includeExecutedValues:false}));
    const exercises=await data<Array<{id:string;name:string;exercise_group_id:string;exercise_type:string;version:number}>>(await call(`/workspaces/${f.space}/exercises`,f.coach));
    expect(exercises).toHaveLength(1);expect(exercises[0].id).not.toBe(original!.id);
    expect((await call(`/workspaces/${f.space}/programs/${copy.id}`,f.client)).status).toBe(200);
    const e=exercises[0];expect((await call(`/workspaces/${f.space}/exercises/${e.id}`,f.coach,{exerciseGroupId:e.exercise_group_id,name:'Client-specific squat',exerciseType:e.exercise_type,version:e.version},'PATCH')).status).toBe(200);
    expect(await env.DB.prepare('SELECT name FROM exercises WHERE id=?').bind(original!.id).first()).toMatchObject({name:'Back Squat'});
    expect((await call(`/workspaces/${f.workspaceId}/programs`,f.coach,{name:'Wrong space',ownerUserId:f.clientId})).status).toBe(400);
    expect((await call(`/workspaces/${f.space}/programs`,f.coach,{name:'Wrong owner',ownerUserId:f.coachId})).status).toBe(400);
    await call(`/clients/${f.clientId}/release`,f.coach,{relationshipId:f.relationship});
    expect((await call(`/workspaces/${f.space}/programs/${copy.id}`,f.client)).status).toBe(200);
    const spaces=await Promise.all([call('/workspaces',f.coach,{name:'My training'}),call('/workspaces',f.coach,{name:'My planning'})]);
    expect(spaces.map(r=>r.status)).toEqual([201,201]);
    const personal=await data<{id:string}>(spaces[0]);
    expect((await call(`/workspaces/${personal.id}/exercises`,f.second)).status).toBe(403);
    expect((await call(`/workspaces/${personal.id}/exercises`,f.coach)).status).toBe(200);
    expect((await call('/workspaces',f.coach,{name:'Organization',kind:'organization'})).status).toBe(403);
  });

  it('removes derived access when coach or client roster membership is suspended', async () => {
    const f=await fixture();
    await call(`/workspaces/${f.workspaceId}/members/${f.coachId}`,f.owner,{status:'suspended'},'PATCH');
    expect((await call(`/workspaces/${f.space}/exercises`,f.coach)).status).toBe(403);
    expect((await call(`/clients/${f.clientId}/claim`,f.coach,{})).status).toBe(403);
    await call(`/workspaces/${f.workspaceId}/members/${f.coachId}`,f.owner,{status:'active'},'PATCH');
    await call(`/workspaces/${f.workspaceId}/members/${f.clientId}`,f.owner,{status:'suspended'},'PATCH');
    expect((await call(`/workspaces/${f.space}/exercises`,f.coach)).status).toBe(403);
    expect((await call(`/workspaces/${f.space}/exercises`,f.client)).status).toBe(403);
  });
});
