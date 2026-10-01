import { spawnSync } from 'node:child_process';
import { ACCOUNT_ID, ACCESS_IDP_ID, EMAIL, REPOSITORY } from './config.mjs';

export function createOperations(env = process.env) {
  async function api(path, { method = 'GET', body } = {}) {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}${path}`, {
      method, headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok || result.success === false) throw new Error(`Cloudflare ${method} ${path}: ${response.status} ${JSON.stringify(result.errors ?? [])}`);
    return result.result;
  }
  async function list(path) {
    const result = [];
    for (let page = 1; ; page++) {
      const rows = await api(`${path}?per_page=100&page=${page}`);
      if (!Array.isArray(rows)) throw new Error(`Unexpected inventory response for ${path}.`);
      result.push(...rows);
      if (rows.length < 100) return result;
    }
  }
  function wrangler(args) {
    const result = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', ...args], {
      stdio: 'inherit', env: { ...env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID, WRANGLER_LOG_PATH: '.wrangler/deployment.log' },
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Wrangler ${args[0]} failed.`);
  }
  async function query(id, sql, params = []) {
    const results = await api(`/d1/database/${id}/query`, { method: 'POST', body: { sql, params } });
    if (results.some(result => !result.success)) throw new Error('D1 query failed.');
    return results[0]?.results ?? [];
  }
  async function preflight(names) {
    const [workers, databases, apps, policies] = await Promise.all([
      list('/workers/workers'), list('/d1/database'), list('/access/apps'), list('/access/policies'),
    ]);
    const single = (rows, match, type) => {
      const matches = rows.filter(match);
      if (matches.length > 1) throw new Error(`Ambiguous ${type} ownership.`);
      return matches[0];
    };
    const worker = single(workers, x => x.name === names.worker, 'Worker');
    if (worker) {
      const settings = await api(`/workers/scripts/${names.worker}/settings`);
      const vars = Object.fromEntries((settings.bindings ?? []).filter(b => b.type === 'plain_text').map(b => [b.name, b.text]));
      if (vars.MANAGED_BY !== REPOSITORY || vars.DEPLOYMENT_LANE !== names.branch) throw new Error('Worker name collision: refusing an unowned Worker.');
    }
    const db = single(databases, x => x.name === names.database, 'database');
    if (db) {
      const rows = await query(db.uuid, 'SELECT repository, lane FROM _liftlog_deployment_owner');
      if (rows.length !== 1 || rows[0].repository !== REPOSITORY || rows[0].lane !== names.branch) throw new Error('Database name collision: ownership was not verified.');
    }
    const app = single(apps, x => x.name === names.access, 'Access application');
    if (app && (!worker || app.type !== 'self_hosted' || app.destinations?.length !== 1 || app.destinations[0].worker_id !== worker.id || app.destinations[0].type !== 'worker')) throw new Error('Access application collision.');
    const policy = single(policies, x => x.name === `${names.access} allowlist`, 'Access policy');
    assertPolicy(policy);
    return { worker, db, app, policy };
  }
  async function ensureAccess(names, inventory) {
    const workers = await list('/workers/workers');
    const worker = workers.find(x => x.name === names.worker);
    if (!worker?.id) throw new Error('Cannot resolve the Worker identity for Access.');
    const policy = inventory.policy ?? await api('/access/policies', { method: 'POST', body: {
      name: `${names.access} allowlist`, decision: 'allow', include: [{ email: { email: EMAIL } }],
    } });
    const body = { name: names.access, type: 'self_hosted', destinations: [{ type: 'worker', worker_id: worker.id }],
      app_launcher_visible: false, session_duration: '6h', allowed_idps: [ACCESS_IDP_ID],
      allow_authenticate_via_warp: false,
      policies: [{ id: policy.id, account_id: ACCOUNT_ID, precedence: 1 }] };
    return api(inventory.app ? `/access/apps/${inventory.app.id}` : '/access/apps', {
      method: inventory.app ? 'PUT' : 'POST', body,
    });
  }
  async function smoke(names, id) {
    const users = await query(id, 'SELECT email_normalized, status FROM users');
    if (users.length !== 1 || users[0].email_normalized !== EMAIL || users[0].status !== 'active') throw new Error('Hosted owner seed verification failed.');
    const memberships = await query(id, "SELECT role FROM workspace_members WHERE user_id='user-owner'");
    if (memberships.length !== 1 || memberships[0].role !== 'owner') throw new Error('Hosted workspace seed verification failed.');
    for (const path of ['/', '/api/session', '/api/local-auth/users', '/api/testing/fixtures']) {
      const response = await fetch(names.origin + path, { redirect: 'manual' });
      const location = response.headers.get('location');
      if (![302, 303, 307].includes(response.status) || !location || !new URL(location, names.origin).hostname.endsWith('.cloudflareaccess.com')) throw new Error(`Access redirect verification failed for ${path}: ${response.status}`);
    }
  }
  return { api, query, wrangler, preflight, ensureAccess, smoke };
}

export function assertPolicy(policy) {
  if (!policy) return;
  if (policy.decision !== 'allow' || policy.exclude?.length || policy.require?.length || policy.include?.length !== 1
    || Object.keys(policy.include[0]).join() !== 'email' || policy.include[0].email?.email !== EMAIL) throw new Error('Access policy collision: refusing to overwrite unrelated rules.');
}
