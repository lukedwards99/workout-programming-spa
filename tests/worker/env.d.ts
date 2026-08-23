import type { D1Migration } from 'cloudflare:test';

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      APP_ENV: 'test';
      LOCAL_AUTH_ENABLED: string;
      TEST_MIGRATIONS: D1Migration[];
      TEST_SEEDS: D1Migration[];
    }
  }
}

export {};
