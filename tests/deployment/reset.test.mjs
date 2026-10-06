import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deployLane } from '../../scripts/deploy-lane.mjs';
import { ACCOUNT_ID, EMAIL, REPOSITORY, SUBDOMAIN } from '../../scripts/cloudflare/config.mjs';

const inputs = branch => ({ CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID, CLOUDFLARE_WORKERS_SUBDOMAIN: SUBDOMAIN,
  CLOUDFLARE_ACCESS_ALLOWED_EMAIL: EMAIL, CLOUDFLARE_API_TOKEN: 'test-token', GITHUB_REPOSITORY: REPOSITORY,
  GITHUB_REF_NAME: branch, GITHUB_REF_TYPE: 'branch', LANE_RESET_APPROVED: `${ACCOUNT_ID}:${branch}`, GITHUB_SHA: 'test-sha' });

test('reset isolates environments, protects Access before deleting data, and closes on failure', async () => {
  const previous = process.cwd();
  const directory = await mkdtemp(join(tmpdir(), 'liftlog-deployment-test-'));
  process.chdir(directory);
  try {
    await mkdir('dist/hosted', { recursive: true });
    await writeFile('dist/hosted/provenance.json', JSON.stringify({ sha: 'test-sha' }));
    for (const branch of ['dev', 'main']) {
      for (const fail of [null, 'migrate', 'smoke']) {
        const events = [];
        const operations = {
          preflight: async names => { events.push('preflight'); return { db: { uuid: `${names.branch}-old` } }; },
          wrangler: async args => {
            const config = JSON.parse(await readFile(args[args.indexOf('--config') + 1], 'utf8'));
            assert.equal(config.name, branch === 'dev' ? 'liftlog-dev' : 'liftlog-production');
            if (args.includes('--dry-run')) events.push('dry-run');
            else if (args[0] === 'deploy') events.push(config.main.endsWith('maintenance-entry.ts') ? 'maintenance' : 'activate');
            else if (args.includes('migrations')) {
              events.push('migrate');
              if (fail === 'migrate') throw new Error('migration failure');
            } else events.push('seed');
          },
          ensureAccess: async () => { events.push('access'); },
          api: async (path, options) => {
            if (options.method === 'DELETE') { assert.equal(path, `/d1/database/${branch}-old`); events.push('delete'); }
            else { assert.equal(options.body.name, branch === 'dev' ? 'liftlog-dev' : 'liftlog-production'); events.push('create'); return { uuid: `${branch}-new` }; }
          },
          query: async id => { assert.equal(id, `${branch}-new`); events.push('ownership'); },
          smoke: async () => { events.push('smoke'); if (fail === 'smoke') throw new Error('smoke failure'); },
        };
        if (fail) await assert.rejects(deployLane(branch, inputs(branch), operations));
        else await deployLane(branch, inputs(branch), operations);
        assert.deepEqual(events.slice(0, 5), ['preflight', 'dry-run', 'maintenance', 'access', 'delete']);
        assert.equal(events.at(-1), fail ? 'maintenance' : 'smoke');
        if (fail === 'migrate') assert.ok(!events.includes('activate'));
      }
    }
    await assert.rejects(deployLane('dev', { ...inputs('dev'), GITHUB_SHA: 'stale' }, {
      preflight: () => { throw new Error('must not reach remote operations'); },
    }), /artifact/);
  } finally { process.chdir(previous); await rm(directory, { recursive: true, force: true }); }
});
