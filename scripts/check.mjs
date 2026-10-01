import { spawnSync } from 'node:child_process';
const env = { ...process.env, WRANGLER_LOG_PATH: '.wrangler/verification.log' };
for (const task of ['types:check', 'typecheck', 'test:worker', 'test:deployment', 'test:e2e', 'build:hosted', 'dry-run:hosted']) {
  const result = spawnSync('npm', ['run', task], { stdio: 'inherit', env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
