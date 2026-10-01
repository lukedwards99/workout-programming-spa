import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateInputs, laneConfig, REPOSITORY } from './cloudflare/config.mjs';
import { createOperations } from './cloudflare/operations.mjs';

export async function deployLane(branch, env = process.env, operations = createOperations(env)) {
  const names = validateInputs(branch, env);
  // These must already have been built and verified by the same checkout.
  const stamp = JSON.parse(await readFile('dist/hosted/provenance.json', 'utf8'));
  if (stamp.sha !== env.GITHUB_SHA) throw new Error('Hosted artifact is not from this deployment commit.');
  const inventory = await operations.preflight(names);
  await mkdir('.wrangler', { recursive: true });
  const configPath = resolve(`.wrangler/deploy-${branch}.json`);
  const writeConfig = async (id, maintenance) => writeFile(configPath, JSON.stringify(laneConfig(branch, id, { maintenance, sha: env.GITHUB_SHA }), null, 2));
  await writeConfig(inventory.db?.uuid, false);
  await operations.wrangler(['deploy', '--config', configPath, '--dry-run', '--outdir', '.wrangler/dry-run']);
  let closed = false;
  try {
    await writeConfig(undefined, true);
    await operations.wrangler(['deploy', '--config', configPath]);
    closed = true;
    await operations.ensureAccess(names, inventory);
    if (inventory.db) await operations.api(`/d1/database/${inventory.db.uuid}`, { method: 'DELETE' });
    const database = await operations.api('/d1/database', { method: 'POST', body: { name: names.database, primary_location_hint: 'enam' } });
    if (!database.uuid) throw new Error('Database creation returned no UUID.');
    await operations.query(database.uuid, 'CREATE TABLE _liftlog_deployment_owner (repository TEXT NOT NULL, lane TEXT NOT NULL)');
    await operations.query(database.uuid, 'INSERT INTO _liftlog_deployment_owner VALUES (?, ?)', [REPOSITORY, branch]);
    await writeConfig(database.uuid, false);
    await operations.wrangler(['d1', 'migrations', 'apply', 'DB', '--config', configPath, '--remote']);
    await operations.wrangler(['d1', 'execute', 'DB', '--config', configPath, '--remote', '--file', 'cloudflare/hosted-seed.sql']);
    await operations.wrangler(['deploy', '--config', configPath]);
    await operations.smoke(names, database.uuid);
    console.log(JSON.stringify({ ...names, databaseId: database.uuid, sha: env.GITHUB_SHA }));
    if (env.GITHUB_STEP_SUMMARY) {
      const { appendFile } = await import('node:fs/promises');
      await appendFile(env.GITHUB_STEP_SUMMARY, `## LiftLog ${branch}\n\n${names.origin}\n\nCommit: ${env.GITHUB_SHA}\n\n**All hosted data was reset.** Cloudflare Access is required.\n`);
    }
  } catch (error) {
    if (closed) {
      await writeConfig(undefined, true);
      await operations.wrangler(['deploy', '--config', configPath]);
    }
    throw error;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  deployLane(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
}
