import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';

export default defineConfig(async () => {
  const migrations = await readD1Migrations('./migrations');
  const seeds = await readD1Migrations('./seed');
  return {
    plugins: [
      cloudflareTest({
        main: './worker/index.ts',
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: { bindings: { TEST_MIGRATIONS: migrations, TEST_SEEDS: seeds } },
      }),
    ],
    test: {
      include: ['tests/worker/**/*.test.ts'],
      testTimeout: 30000,
    },
  };
});
