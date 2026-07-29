# Local E2E Baseline

Captured July 27–29, 2026 on a MacBook Pro with an Apple M1 Pro (8 CPU cores: 6 performance and 2 efficiency), 16 GB memory, and macOS 26.5.2 (25F84).

| Tool | Version |
| --- | --- |
| Node | 22.14.0 |
| npm | 11.3.0 |
| Playwright | 1.61.1 |
| Browser | Playwright Chromium 1228 |

## Method

Use `npm run test:e2e:profile -- --workers=N` for each run. It leaves the normal E2E command unchanged and writes a Playwright JSON report to the ignored `test-results/e2e-results.json` path. Review a report with:

```bash
node scripts/report-e2e-timings.mjs
```

`npm run test:e2e:benchmark` runs the complete matrix, archives each report in the ignored `test-results/e2e-benchmarks/` directory, and writes machine-readable results to the ignored `test-results/e2e-benchmark-summary.json` file.

| Workers | Run | Wall-clock | Playwright duration | Passed | Failed | Flaky | Skipped | Retries |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 18m 42.0s | 18m 41.0s | 142 | 0 | 0 | 0 | 0 |
| 1 | 2 | 19m 13.1s | 19m 12.2s | 142 | 0 | 0 | 0 | 0 |
| 1 | 3 | 18m 37.1s | 18m 36.2s | 142 | 0 | 0 | 0 | 0 |
| 2 | 1 | 9m 26.8s | 9m 25.9s | 142 | 0 | 0 | 0 | 0 |
| 2 | 2 | 9m 17.8s | 9m 17.1s | 142 | 0 | 0 | 0 | 0 |
| 2 | 3 | 9m 7.9s | 9m 7.1s | 142 | 0 | 0 | 0 | 0 |
| 4 | 1 | 4m 33.5s | 4m 32.7s | 142 | 0 | 0 | 0 | 0 |
| 4 | 2 | 4m 31.7s | 4m 30.9s | 142 | 0 | 0 | 0 | 0 |
| 4 | 3 | 4m 33.2s | 4m 32.4s | 142 | 0 | 0 | 0 | 0 |

| Workers | Median wall-clock | Median Playwright duration |
| ---: | ---: | ---: |
| 1 | 18m 42.0s | 18m 41.0s |
| 2 | 9m 17.8s | 9m 17.1s |
| 4 | 4m 33.2s | 4m 32.4s |

The final four-worker report had a 6.40s median test duration and 14.17s p95. Playwright JSON does not expose setup-hook duration separately.

## Slowest tests (four-worker run 3)

| Duration | Test |
| ---: | --- |
| 17.36s | Import/Export Round-Trip: full round-trip export, clear, import, verify |
| 16.27s | Isolation ISO-3: restore A does not affect B |
| 15.15s | Summary Statistics: breakdowns and persisted column choices |
| 14.97s | Regression P2-4: program backup restore |
| 14.95s | Copy Exercises: copies selected exercises between programs |
| 14.46s | Cardio: backup and restore preserve cardio sets |
| 14.41s | Workout Generator GEN-6: deep copy preserves data |
| 14.17s | Summary Statistics: exercise-group percentage breakdown |
| 13.59s | Workout: adds different set types |
| 13.44s | Summary Statistics: workout summary stats |
| 13.13s | Workout: working-set count updates |
| 13.09s | Isolation ISO-7: cross-program exercise copy |
| 12.82s | Summary Statistics: narrow viewport controls |
| 12.70s | Summary Statistics: mesocycle summary stats |
| 12.60s | Cardio: copied workouts preserve cardio data |
| 12.37s | Cardio: program, edit, reorder, and persist sets |
| 12.17s | Isolation ISO-1: changes in program A never appear in program B |
| 11.97s | Program Data: imports an exercise JSON export |
| 11.76s | Summary Statistics: set-type filters and detail rows |
| 11.69s | Summary Statistics: workout summary updates after editing set data |

## Duration by spec file (four-worker run 3)

| Total | Tests | Spec |
| ---: | ---: | --- |
| 189.75s | 16 | `summary-statistics.spec.ts` |
| 140.09s | 13 | `workout.spec.ts` |
| 116.72s | 13 | `regression.spec.ts` |
| 99.45s | 19 | `mesocycle.spec.ts` |
| 94.12s | 14 | `workout-generator.spec.ts` |
| 79.62s | 8 | `isolation.spec.ts` |
| 58.19s | 8 | `program-data.spec.ts` |
| 51.74s | 9 | `program-exercises.spec.ts` |
| 49.69s | 11 | `program.spec.ts` |
| 49.30s | 4 | `cardio.spec.ts` |
| 33.37s | 10 | `home.spec.ts` |
| 28.82s | 3 | `copy.spec.ts` |
| 28.01s | 5 | `folder-backup.spec.ts` |
| 24.42s | 7 | `tutorial.spec.ts` |
| 17.36s | 1 | `import-export.spec.ts` |
| 2.63s | 1 | `database-cutover.spec.ts` |

## SQL.js WASM diagnostic

Run with `npm run test:e2e:wasm-profile`. The probe performs ten fresh-context navigations and writes its raw observations to the ignored `test-results/e2e-wasm-diagnostics.json` file.

- 10 requests, all HTTP 200; no failures or retries.
- Median response duration: 376ms; total response duration: 3.685s.
- Each request went to `https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/sql-wasm.wasm`.
- Responses were CDN cache hits (`x-cache: HIT, HIT`, `cf-cache-status: HIT`) with immutable one-year cache control, but no response was service-worker-cached.

## Phase 1 hypotheses, ranked by measured evidence

1. Load SQL.js WASM from the installed application asset: each fresh browser context still incurs a remote request with a 376ms median response time.
2. Remove redundant startup cleanup and replace synchronization sleeps: the slowest tests concentrate in workflows that create, clear, import, restore, and rebuild data.
3. Add reusable setup fixtures for the summary-statistics, workout, regression, generator, and isolation suites, which account for the largest measured spec totals.

No failures, retries, or suspected flakes were observed across all nine benchmark runs.
