#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const resultsPath = resolve(process.argv[2] ?? 'test-results/e2e-results.json');
const report = JSON.parse(await readFile(resultsPath, 'utf8'));
const tests = [];

function visitSuite(suite, ancestors = []) {
  const titles = suite.title ? [...ancestors, suite.title] : ancestors;
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const results = test.results ?? [];
      tests.push({
        title: [...titles, spec.title].filter(Boolean).join(' › '),
        file: spec.file ?? suite.file ?? 'unknown file',
        duration: results.reduce((total, result) => total + (result.duration ?? 0), 0),
        results,
        status: results.at(-1)?.status ?? test.status ?? 'unknown',
      });
    }
  }
  for (const child of suite.suites ?? []) visitSuite(child, titles);
}

for (const suite of report.suites ?? []) visitSuite(suite);

function percentile(values, fraction) {
  if (values.length === 0) return 0;
  return values[Math.max(0, Math.ceil(values.length * fraction) - 1)];
}

function formatDuration(milliseconds) {
  return milliseconds < 1_000 ? `${milliseconds.toFixed(0)}ms` : `${(milliseconds / 1_000).toFixed(2)}s`;
}

const durations = tests.map((test) => test.duration).sort((a, b) => a - b);
const statusCounts = { passed: 0, failed: 0, skipped: 0, flaky: 0, retried: 0 };
for (const test of tests) {
  if (test.status === 'passed') statusCounts.passed++;
  else if (test.status === 'skipped') statusCounts.skipped++;
  else statusCounts.failed++;
  if (test.results.length > 1) {
    statusCounts.retried += test.results.length - 1;
    if (test.status === 'passed') statusCounts.flaky++;
  }
}

const files = new Map();
for (const test of tests) {
  const current = files.get(test.file) ?? { duration: 0, tests: 0 };
  current.duration += test.duration;
  current.tests++;
  files.set(test.file, current);
}

console.log(`Report: ${resultsPath}`);
console.log(`Tests: ${tests.length} total | ${statusCounts.passed} passed | ${statusCounts.failed} failed | ${statusCounts.flaky} flaky | ${statusCounts.skipped} skipped | ${statusCounts.retried} retries`);
console.log(`Test duration: median ${formatDuration(percentile(durations, 0.5))} | p95 ${formatDuration(percentile(durations, 0.95))}`);
console.log('Setup-hook duration: unavailable in Playwright JSON reporter');
console.log('\n20 slowest tests');
for (const test of [...tests].sort((a, b) => b.duration - a.duration).slice(0, 20)) {
  console.log(`${formatDuration(test.duration).padStart(8)}  ${test.title} (${test.file})`);
}
console.log('\nDuration by spec file');
for (const [file, stats] of [...files.entries()].sort(([, a], [, b]) => b.duration - a.duration)) {
  console.log(`${formatDuration(stats.duration).padStart(8)}  ${String(stats.tests).padStart(3)} tests  ${file}`);
}
