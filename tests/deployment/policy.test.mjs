import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNT_ID, EMAIL, SUBDOMAIN, REPOSITORY, validateInputs, laneConfig } from '../../scripts/cloudflare/config.mjs';
import { assertPolicy, createOperations } from '../../scripts/cloudflare/operations.mjs';
import { assertPromotionSource, deploymentState, checkPromotion } from '../../scripts/check-promotion.mjs';
const inputs = { CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID, CLOUDFLARE_WORKERS_SUBDOMAIN: SUBDOMAIN,
  CLOUDFLARE_ACCESS_ALLOWED_EMAIL: EMAIL, CLOUDFLARE_API_TOKEN: 'test-token', GITHUB_REPOSITORY: REPOSITORY,
  CLOUDFLARE_ACCESS_OTP_IDP_ID: '11111111-1111-4111-8111-111111111111',
  GITHUB_REF_NAME: 'dev', GITHUB_REF_TYPE: 'branch', LANE_RESET_APPROVED: `${ACCOUNT_ID}:dev` };

test('rejects wrong accounts, branches, repository, allowlist, token and reset approval', () => {
  assert.equal(validateInputs('dev', inputs).worker, 'liftlog-dev');
  for (const key of Object.keys(inputs).filter(key => key !== 'CLOUDFLARE_API_TOKEN')) assert.throws(() => validateInputs('dev', { ...inputs, [key]: 'wrong' }), key);
  assert.throws(() => validateInputs('feature', inputs));
  assert.throws(() => validateInputs('dev', { ...inputs, CLOUDFLARE_API_TOKEN: '' }));
});
test('OTP setup is required before deployment can reach Cloudflare', () => {
  assert.equal(validateInputs('dev', inputs).accessIdpId, inputs.CLOUDFLARE_ACCESS_OTP_IDP_ID);
  for (const value of [undefined, '', 'onetimepin', 'not-a-provider-id']) {
    assert.throws(() => validateInputs('dev', { ...inputs, CLOUDFLARE_ACCESS_OTP_IDP_ID: value }), /One-time PIN provider UUID/);
  }
});
test('hosted environments are separate and cannot enable local auth or asset routing', () => {
  const dev = laneConfig('dev', 'dev-database'), main = laneConfig('main', 'main-database');
  assert.notEqual(dev.name, main.name);
  assert.equal(dev.vars.DEV_IDENTITY_SWITCH_ENABLED, 'true');
  assert.equal(dev.vars.DEV_IDENTITY_SWITCH_EMAIL, EMAIL);
  assert.equal(main.vars.DEV_IDENTITY_SWITCH_ENABLED, 'false');
  assert.equal(main.vars.DEV_IDENTITY_SWITCH_EMAIL, '');
  for (const config of [dev, main]) {
    assert.equal(config.account_id, ACCOUNT_ID); assert.equal(config.vars.LOCAL_AUTH_ENABLED, 'false');
    assert.equal(config.preview_urls, false); assert.equal(config.assets, undefined);
    for (const resource of ['queues', 'r2_buckets', 'containers', 'send_email']) assert.equal(config[resource], undefined);
  }
  const maintenance = laneConfig('dev', undefined, { maintenance: true });
  assert.equal(maintenance.d1_databases, undefined); assert.deepEqual(maintenance.triggers.crons, []);
});
test('accepts approved beta email allowlists but rejects broad or unrelated Access rules', () => {
  assert.doesNotThrow(() => assertPolicy({ decision: 'allow', include: [{ email: { email: EMAIL } }] }));
  const beta = { decision: 'allow', include: [{ email: { email: EMAIL } }, { email: { email: 'friend@example.com' } }] };
  assert.doesNotThrow(() => assertPolicy(beta));
  for (const policy of [{ decision: 'bypass' }, { decision: 'allow', include: [{ everyone: {} }] },
    { ...beta, require: [{ email_domain: { domain: 'example.com' } }] },
    { ...beta, exclude: [{ email: { email: 'friend@example.com' } }] },
    { decision: 'allow', include: [{ email: { email: 'friend@example.com' } }] },
    { ...beta, include: [...beta.include, { email_domain: { domain: 'example.com' } }] },
    { ...beta, include: [...beta.include, { email: { email: '*@example.com' } }] },
    { ...beta, include: [...beta.include, { email: { email: 'invalid' } }] },
    { ...beta, include: [...beta.include, { email: { email: 'friend@example.com' }, everyone: {} }] },
    { ...beta, include: [...beta.include, null] }, { decision: 'allow', include: [] }]) assert.throws(() => assertPolicy(policy));
});
test('promotion requires same-repository dev and latest successful exact-commit deployment', async () => {
  const pr = { base: { ref: 'main' }, head: { ref: 'dev', sha: 'head-sha', repo: { full_name: REPOSITORY } } };
  assert.equal(assertPromotionSource(pr, REPOSITORY), true);
  assert.throws(() => assertPromotionSource({ ...pr, head: { ...pr.head, ref: 'feature' } }, REPOSITORY));
  assert.throws(() => assertPromotionSource({ ...pr, head: { ...pr.head, repo: { full_name: 'fork/repo' } } }, REPOSITORY));
  const run = { id: 1, head_sha: 'head-sha', head_branch: 'dev', event: 'push', path: '.github/workflows/deploy-lanes.yml', status: 'completed', conclusion: 'success' };
  assert.equal(deploymentState([], 'head-sha'), 'pending');
  assert.equal(deploymentState([run], 'other-sha'), 'pending');
  assert.equal(deploymentState([run], 'head-sha'), 'success');
  assert.equal(deploymentState([run, { ...run, id: 2, conclusion: 'failure' }], 'head-sha'), 'failure');
  assert.equal(deploymentState([{ ...run, status: 'in_progress' }], 'head-sha'), 'pending');
  await assert.rejects(checkPromotion({ event: { pull_request: pr }, repository: REPOSITORY, token: 'test', attempts: 1,
    fetcher: async () => ({ ok: true, json: async () => ({ workflow_runs: [] }) }) }), /No successful/);
});
test('resource collisions stop preflight before any mutation', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(init.method);
    let result = [];
    if (url.includes('/workers/workers?')) result = [{ name: 'liftlog-dev', id: 'worker-id' }];
    if (url.endsWith('/settings')) result = { bindings: [], tags: [] };
    return { ok: true, json: async () => ({ success: true, result }) };
  };
  try {
    await assert.rejects(createOperations(inputs).preflight(validateInputs('dev', inputs)), /unowned/);
    assert.ok(calls.every(method => method === 'GET'));
  } finally { globalThis.fetch = original; }
});

test('Access updates pin OTP and preserve existing beta policies and app identity in each lane', async () => {
  const original = globalThis.fetch;
  const writes = [];
  globalThis.fetch = async (url, init) => {
    if (init.method !== 'GET') writes.push({ url, ...init, body: JSON.parse(init.body) });
    return { ok: true, json: async () => ({ success: true,
      result: init.method === 'GET' ? [{ name: 'liftlog-dev', id: 'dev-worker' }, { name: 'liftlog-production', id: 'main-worker' }] : { id: 'app-id' } }) };
  };
  try {
    for (const branch of ['dev', 'main']) {
      const policy = { id: `${branch}-policy`, decision: 'allow', include: [{ email: { email: EMAIL } }, { email: { email: 'friend@example.com' } }] };
      const originalPolicy = structuredClone(policy);
      const names = validateInputs(branch, { ...inputs, GITHUB_REF_NAME: branch, LANE_RESET_APPROVED: `${ACCOUNT_ID}:${branch}` });
      await createOperations(inputs).ensureAccess(names, { app: { id: `${branch}-app` }, policy });
      assert.deepEqual(policy, originalPolicy);
      const write = writes.at(-1);
      assert.equal(write.method, 'PUT');
      assert.ok(write.url.endsWith(`/accounts/${ACCOUNT_ID}/access/apps/${branch}-app`));
      assert.deepEqual(write.body.allowed_idps, [inputs.CLOUDFLARE_ACCESS_OTP_IDP_ID]);
      assert.equal(write.body.allow_authenticate_via_warp, false);
      assert.equal(write.body.session_duration, '6h');
      assert.deepEqual(write.body.destinations, [{ type: 'worker', worker_id: `${branch}-worker` }]);
      assert.deepEqual(write.body.policies, [{ id: `${branch}-policy`, account_id: ACCOUNT_ID, precedence: 1 }]);
    }
    assert.equal(writes.length, 2);
  } finally { globalThis.fetch = original; }
});

test('a new OTP application starts with only the owner and never creates an identity provider', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined });
    const result = init.method === 'GET' ? [{ name: 'liftlog-dev', id: 'worker-id' }]
      : url.endsWith('/access/policies') ? { id: 'policy-id' } : { id: 'app-id' };
    return { ok: true, json: async () => ({ success: true, result }) };
  };
  try {
    await createOperations(inputs).ensureAccess(validateInputs('dev', inputs), {});
    const writes = calls.filter(call => call.method !== 'GET');
    assert.equal(writes.length, 2);
    assert.deepEqual(writes[0].body.include, [{ email: { email: EMAIL } }]);
    assert.deepEqual(writes[1].body.allowed_idps, [inputs.CLOUDFLARE_ACCESS_OTP_IDP_ID]);
    assert.ok(calls.every(call => !call.url.includes('/identity_providers')));
  } finally { globalThis.fetch = original; }
});
