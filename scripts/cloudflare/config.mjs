import { resolve } from 'node:path';
export const ACCOUNT_ID = 'ddb45a91c623b716978d580d88298be1';
export const SUBDOMAIN = 'luke-edwards20';
export const REPOSITORY = 'lukedwards99/workout-programming-spa';
export const EMAIL = 'luke.edwards20@gmail.com';
// Existing Cloudflare account sign-in in the personal Zero Trust organization.
export const ACCESS_IDP_ID = '36a7605a-c3e1-4317-a69a-5822337b048f';

export function laneNames(branch) {
  if (!['dev', 'main'].includes(branch)) throw new Error('Only dev and main may deploy.');
  const name = branch === 'dev' ? 'liftlog-dev' : 'liftlog-production';
  return { branch, worker: name, database: name, access: `LiftLog: ${branch}`, origin: `https://${name}.${SUBDOMAIN}.workers.dev` };
}

export function validateInputs(branch, env) {
  const names = laneNames(branch);
  if (env.CLOUDFLARE_ACCOUNT_ID !== ACCOUNT_ID || env.CLOUDFLARE_WORKERS_SUBDOMAIN !== SUBDOMAIN) throw new Error('Refusing any account or subdomain other than the personal LiftLog account.');
  if (env.GITHUB_REPOSITORY !== REPOSITORY || env.GITHUB_REF_NAME !== branch || env.GITHUB_REF_TYPE !== 'branch') throw new Error('Deployment must run from its matching repository and branch.');
  if (env.LANE_RESET_APPROVED !== `${ACCOUNT_ID}:${branch}`) throw new Error('Explicit lane reset authorization is required.');
  if (env.CLOUDFLARE_ACCESS_ALLOWED_EMAIL !== EMAIL) throw new Error('The initial Access allowlist must contain only the configured owner.');
  if (!env.CLOUDFLARE_API_TOKEN?.trim()) throw new Error('A personal-account API token is required.');
  return names;
}

export function laneConfig(branch, databaseId, { maintenance = false, sha = 'verification' } = {}) {
  const names = laneNames(branch);
  return {
    name: names.worker, account_id: ACCOUNT_ID,
    main: resolve(maintenance ? 'worker/maintenance-entry.ts' : 'dist/hosted/index.ts'),
    compatibility_date: '2026-09-30', workers_dev: true, preview_urls: false,
    vars: { APP_ENV: branch === 'dev' ? 'dev' : 'production', LOCAL_AUTH_ENABLED: 'false',
      DEV_IDENTITY_SWITCH_ENABLED: branch === 'dev' && !maintenance ? 'true' : 'false',
      DEV_IDENTITY_SWITCH_EMAIL: branch === 'dev' && !maintenance ? EMAIL : '',
      MANAGED_BY: REPOSITORY, DEPLOYMENT_LANE: branch, DEPLOYMENT_SHA: sha },
    ...(databaseId ? { d1_databases: [{ binding: 'DB', database_name: names.database,
      database_id: databaseId, migrations_dir: resolve('migrations') }] } : {}),
    triggers: { crons: maintenance ? [] : ['0 3 * * *'] },
    observability: { enabled: true },
  };
}
