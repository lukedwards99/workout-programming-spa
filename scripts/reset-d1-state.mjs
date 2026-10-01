import fs from 'node:fs/promises';
import path from 'node:path';

const mode = process.argv[2];
if (!['local', 'e2e'].includes(mode)) throw new Error('Usage: node scripts/reset-d1-state.mjs local|e2e');
const root = process.cwd();
const target = path.resolve(root, mode === 'e2e' ? '.wrangler/e2e' : '.wrangler/state');
const allowed = [path.resolve(root, '.wrangler/e2e'), path.resolve(root, '.wrangler/state')];
if (!allowed.includes(target)) throw new Error(`Refusing to remove unexpected path: ${target}`);
await fs.rm(target, { recursive: true, force: true });
console.log(`Reset ${path.relative(root, target)}.`);
