#!/usr/bin/env node

import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const workers = [1, 2, 4];
const runsPerWorker = 3;
const resultsPath = resolve('test-results/e2e-results.json');
const benchmarkDirectory = resolve('test-results/e2e-benchmarks');
const summaryPath = resolve('test-results/e2e-benchmark-summary.json');

function run(command, args, env) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { env, stdio: 'inherit' });
    child.on('error', rejectRun);
    child.on('exit', (code, signal) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${command} ${args.join(' ')} exited with ${code ?? signal}`));
    });
  });
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[1];
}

await mkdir(benchmarkDirectory, { recursive: true });
const runs = [];

for (const workerCount of workers) {
  for (let runIndex = 1; runIndex <= runsPerWorker; runIndex++) {
    const startedAt = performance.now();
    await run('npx', ['playwright', 'test', `--workers=${workerCount}`], {
      ...process.env,
      E2E_PROFILE: '1',
    });
    const wallClockDurationMs = performance.now() - startedAt;
    const report = JSON.parse(await readFile(resultsPath, 'utf8'));
    const archivedReportPath = resolve(benchmarkDirectory, `workers-${workerCount}-run-${runIndex}.json`);
    await cp(resultsPath, archivedReportPath);
    runs.push({
      workers: workerCount,
      run: runIndex,
      wallClockDurationMs,
      playwrightDurationMs: report.stats.duration,
      expected: report.stats.expected,
      unexpected: report.stats.unexpected,
      flaky: report.stats.flaky,
      skipped: report.stats.skipped,
      archivedReportPath,
    });
  }
}

const medians = workers.map((workerCount) => {
  const workerRuns = runs.filter((run) => run.workers === workerCount);
  return {
    workers: workerCount,
    wallClockDurationMs: median(workerRuns.map((run) => run.wallClockDurationMs)),
    playwrightDurationMs: median(workerRuns.map((run) => run.playwrightDurationMs)),
  };
});

await writeFile(summaryPath, `${JSON.stringify({ runs, medians }, null, 2)}\n`);

console.table(
  medians.map((result) => ({
    workers: result.workers,
    wallClockSeconds: (result.wallClockDurationMs / 1_000).toFixed(1),
    playwrightSeconds: (result.playwrightDurationMs / 1_000).toFixed(1),
  })),
);
