import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { laneConfig } from './cloudflare/config.mjs';

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const assets = {};
async function collect(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (item.name.startsWith('.')) continue;
    const path = join(directory, item.name);
    if (item.isDirectory()) await collect(path);
    else {
      const body = await readFile(path);
      assets['/' + relative('dist/client', path).split('\\').join('/')] = {
        body: body.toString('base64'), contentType: types[extname(path)] ?? 'application/octet-stream',
        etag: '"' + createHash('sha256').update(body).digest('hex') + '"',
      };
    }
  }
}
await collect('dist/client');
if (!assets['/index.html']) throw new Error('Missing built frontend.');
await mkdir('dist/hosted', { recursive: true });
await writeFile('dist/hosted/index.ts', `// Generated; do not edit.\nimport { createHostedWorker } from '../../worker/hosted';\nexport default createHostedWorker(${JSON.stringify(assets)});\n`);
await mkdir('.wrangler', { recursive: true });
await writeFile('.wrangler/hosted-check.json', JSON.stringify(laneConfig('dev', '00000000-0000-4000-8000-000000000001'), null, 2));

const { execFileSync } = await import('node:child_process');
await writeFile('dist/hosted/provenance.json', JSON.stringify({ sha: process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() }));
