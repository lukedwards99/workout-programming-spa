# E2E Phase 0 Validation Findings

Validated July 27–29, 2026 against the Phase 0 handoff contract in
`docs/e2e-test-speed-improvement-plan.md`.

## Validation Result

**Phase 0 is complete.**

The profiling implementation remains limited to diagnostics, preserves the normal 142-test suite, and produced the required three-run benchmark matrix for one, two, and four workers.

## Resolved Findings

### P1: Required baseline matrix

All nine required full-suite runs completed:

| Workers | Clean runs | Median wall-clock | Median Playwright duration |
| ---: | ---: | ---: | ---: |
| 1 | 3 | 18m 42.0s | 18m 41.0s |
| 2 | 3 | 9m 17.8s | 9m 17.1s |
| 4 | 3 | 4m 33.2s | 4m 32.4s |

Every run passed 142 tests with no failures, flakes, skips, or retries. The baseline report separates wall-clock and Playwright durations and contains timing tables regenerated from the archived final four-worker report.

### P2: WASM profiling report isolation

The WASM command no longer sets `E2E_PROFILE`, and Playwright runtime artifacts use `test-results/artifacts`. The diagnostic writes only its dedicated `test-results/e2e-wasm-diagnostics.json` output and does not overwrite `test-results/e2e-results.json`.

## Checks That Passed

The following validations succeeded:

- `npm run typecheck`.
- `npm run build`.
- All nine one-, two-, and four-worker benchmark runs.
- The normal Playwright configuration discovers exactly 142 tests across 16 files.
- `wasm-diagnostics.spec.ts` is excluded from normal E2E runs.
- WASM profiling discovers only its 10 diagnostic tests.
- `npm run test:e2e:wasm-profile` passed all 10 samples.
- The WASM diagnostic produced `test-results/e2e-wasm-diagnostics.json`.
- `scripts/report-e2e-timings.mjs` successfully reads and summarizes Playwright JSON.
- Profiling artifacts under `test-results/` are ignored by Git.
- No application behavior, fixed waits, database cleanup, seed fixtures, or other Phase 1 concerns were changed.

The final documented WASM sample observed:

- 10 successful requests.
- A median response duration of 376 ms.
- A total response duration of 3.685 seconds.

## Repository State

The intended Phase 0 deliverables are included in version control:

- `docs/e2e-local-baseline.md`
- `docs/e2e-phase-0-validation-findings.md`
- `docs/e2e-test-speed-improvement-plan.md`
- `scripts/benchmark-e2e.mjs`
- `scripts/report-e2e-timings.mjs`
- `tests/e2e/wasm-diagnostics.spec.ts`
- `package.json`
- `playwright.config.ts`

Raw JSON reports and Playwright artifacts remain ignored under `test-results/`.

## Conclusion

Phase 0 meets its handoff contract. Phase 1 may begin using the four-worker median of 4m 33.2s as the primary local baseline and the archived reports for detailed comparisons.
