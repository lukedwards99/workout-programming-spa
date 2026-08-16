import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

type WasmObservation = {
  requestUrl: string;
  status: number;
  durationMs: number;
  fromServiceWorker: boolean;
  cacheHeaders: Record<string, string | undefined>;
  failure: string | null;
};

const observations: WasmObservation[] = [];
const sampleCount = 10;

function isWasmBinaryRequest(url: string): boolean {
  const parsed = new URL(url);
  return parsed.pathname.endsWith('.wasm')
    && !parsed.searchParams.has('import')
    && !parsed.searchParams.has('url');
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

test.describe.serial('SQL.js WASM diagnostics', () => {
  for (let sample = 1; sample <= sampleCount; sample++) {
    test(`records SQL.js WASM request ${sample}/${sampleCount}`, async ({ page }) => {
      const startedAt = new Map<string, number>();
      const finished: Promise<void>[] = [];

      page.on('request', (request) => {
        if (isWasmBinaryRequest(request.url())) startedAt.set(request.url(), Date.now());
      });
      page.on('response', (response) => {
        if (!isWasmBinaryRequest(response.url())) return;
        const completed = response.finished().then((failure) => {
          const headers = response.headers();
          observations.push({
            requestUrl: response.url(),
            status: response.status(),
            durationMs: Date.now() - (startedAt.get(response.url()) ?? Date.now()),
            fromServiceWorker: response.fromServiceWorker(),
            cacheHeaders: {
              age: headers.age,
              'cache-control': headers['cache-control'],
              etag: headers.etag,
              'x-cache': headers['x-cache'],
              'cf-cache-status': headers['cf-cache-status'],
            },
            failure: failure?.message ?? null,
          });
        });
        finished.push(completed);
      });

      await page.goto('/');
      await page.locator('.nav-bar').waitFor();
      await Promise.all(finished);
      expect(observations).toHaveLength(sample);
      expect(new URL(observations.at(-1)!.requestUrl).origin).toBe(new URL(page.url()).origin);
      expect(observations.at(-1)!.requestUrl).not.toContain('cdn.jsdelivr.net');
      expect(observations.at(-1)!.status).toBe(200);
      expect(observations.at(-1)!.failure).toBeNull();
    });
  }

  test.afterAll(async () => {
    const durations = observations.map((observation) => observation.durationMs);
    const output = {
      samplesRequested: sampleCount,
      requestCount: observations.length,
      medianResponseDurationMs: median(durations),
      totalResponseDurationMs: durations.reduce((total, duration) => total + duration, 0),
      failures: observations.filter((observation) => observation.failure !== null),
      observations,
    };
    await mkdir('test-results', { recursive: true });
    await writeFile('test-results/e2e-wasm-diagnostics.json', `${JSON.stringify(output, null, 2)}\n`);
    console.log(`SQL.js WASM diagnostics: ${output.requestCount} requests; median ${output.medianResponseDurationMs}ms; total ${output.totalResponseDurationMs}ms`);
  });
});
