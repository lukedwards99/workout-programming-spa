import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI || process.env.E2E_WASM_PROFILE ? 1 : undefined,
  reporter: process.env.E2E_PROFILE
    ? [
        ['line'],
        ['json', { outputFile: 'test-results/e2e-results.json' }],
      ]
    : 'list',
  testMatch: process.env.E2E_WASM_PROFILE ? '**/wasm-diagnostics.spec.ts' : undefined,
  testIgnore: process.env.E2E_WASM_PROFILE ? undefined : '**/wasm-diagnostics.spec.ts',
  outputDir: 'test-results/artifacts',

  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'on-first-retry',
  },

  webServer: {
    command: 'VITE_E2E=true npx vite --host 127.0.0.1 --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
    timeout: 120000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  timeout: 60000,
  expect: { timeout: 15000 },
});
