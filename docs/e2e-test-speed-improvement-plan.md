# End-to-End Test Speed Improvement Plan

## Purpose

Reduce the local feedback time of LiftLog's Playwright end-to-end suite without reducing meaningful coverage or making the tests less reliable.

This document is intended to be handed directly to an implementation agent. The agent should work in measured phases, record timings before and after each phase, and keep each optimization independently reviewable.

For now, E2E tests are a **local developer workflow only**. Adding or optimizing an E2E job in CI is explicitly deferred and is not required by this plan.

## Current State and Measured Baseline

The repository currently has:

- 142 Chromium end-to-end tests across 16 spec files.
- A measured four-worker median wall-clock runtime of **4 minutes 33.2 seconds** on the benchmark machine.
- One-, two-, and four-worker median wall-clock runtimes of 18m 42.0s, 9m 17.8s, and 4m 33.2s respectively.
- Nine clean benchmark runs totaling 1,278 successful test executions with no failures, flakes, skips, or retries.
- `fullyParallel: true`, but `workers: 1` whenever `CI` is set.
- Two retries in CI, no retries locally.
- A 60-second test timeout and 15-second assertion timeout.
- 167 static `page.waitForTimeout(...)` calls totaling 88 seconds in source. This number substantially undercounts runtime cost because waits in shared helpers and `beforeEach` hooks execute once per consuming test.
- 40 source call sites for `clearDatabase(page)`.
- Repeated creation of programs, exercise libraries, mesocycles, workouts, exercises, and sets through the UI in test setup.
- A SQL.js WASM file loaded from jsDelivr on every fresh application context:
  `https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/sql-wasm.wasm`.
- No repository-owned `.github/workflows` directory exists, and no E2E CI integration is needed right now.

The largest test files and repeated-setup hotspots are:

| File | Tests | Final four-worker summed test duration | Notable cost |
| --- | ---: | ---: | --- |
| `summary-statistics.spec.ts` | 16 | 189.75s | Builds a program, library, mesocycle, and workout before every test |
| `workout.spec.ts` | 13 | 140.09s | Builds a workout hierarchy before every test |
| `regression.spec.ts` | 13 | 116.72s | Heavy UI setup and 35 fixed waits |
| `mesocycle.spec.ts` | 19 | 99.45s | Repeated program and mesocycle setup |
| `workout-generator.spec.ts` | 14 | 94.12s | Creates and opens a program before every test, then builds scenario data |
| `isolation.spec.ts` | 8 | 79.62s | Large multi-program scenarios and long fixed waits |

The top five files account for approximately 60% of summed test duration in the final four-worker run.

### Phase 0 conclusions

Phase 0 established that:

- Local parallelism is effective and close to linear from one to four workers. Worker contention is not the primary bottleneck.
- Four workers are the best measured local configuration and remain the comparison baseline.
- The suite is stable enough to optimize incrementally: no flake signal appeared across the nine-run matrix.
- Each fresh browser context makes a remote SQL.js WASM request. The ten-context diagnostic measured a 376ms median and 3.685s total response time, implying roughly 53 seconds of aggregate network response time across 142 fresh contexts before accounting for overlap.
- Repeated UI arrangement, startup cleanup, fixed synchronization sleeps, and the 300ms persistence debounce are the highest-confidence controllable costs.
- `summary-statistics.spec.ts`, `workout.spec.ts`, `regression.spec.ts`, `mesocycle.spec.ts`, and `workout-generator.spec.ts` should be the first candidates for reusable state after the lower-risk Phase 1 work.

### Important architectural observation

Playwright's built-in `page` fixture creates an isolated browser context for each test. IndexedDB data does not carry from one normal test context into the next. Therefore, calls to `clearDatabase(page)` at the start of a test are normally unnecessary.

Do not blindly remove every call. A few tests call `clearDatabase(page)` in the middle of a scenario to validate import, restore, deletion, or isolation behavior. Those calls represent scenario steps and must be preserved or replaced with an equivalent explicit state transition.

## Goals

Use relative performance targets so results remain meaningful across developer machines.

1. Reduce the passing local full-suite runtime by at least 60% from the recorded baseline.
   - Baseline: 4:33.2 with four workers.
   - Overall target: 1:49.3 or faster on the same machine and under comparable load.
   - Phase 1 minimum checkpoint: at least 25% faster, or 3:25 or faster.
   - Phase 1 stretch checkpoint: 3:00 or faster.
2. Provide a smoke suite that completes in 30 seconds or less locally.
3. Remove all unconditional waits used for synchronization.
   - A fixed wait may remain only when elapsed time itself is the behavior being tested.
   - Every remaining fixed wait must include a comment explaining why a state-based wait cannot be used.
4. Preserve test isolation, persistence coverage, download/upload coverage, and backup/restore coverage.
5. Keep first-retry traces and useful local failure artifacts.
6. Do not hide slowness by merely lowering timeouts or deleting assertions.

## Non-Goals

- Do not convert every end-to-end test to a unit test in one change.
- Do not combine unrelated workflows into a few large, order-dependent tests.
- Do not reuse one mutable browser context across tests.
- Do not disable retries until the suite's flake rate has been measured.
- Do not add, change, or require an E2E CI workflow during this work.
- Do not expose test mutation APIs in a production build.

## Implementation Strategy

Implement the work in the following order. Commit or submit each phase separately when practical, and capture a timing report after each phase.

## Phase 0: Add Repeatable Timing and Diagnostics — Completed

Phase 0 was completed July 29, 2026. Its implementation, raw ignored artifacts, and results are documented in:

- `docs/e2e-local-baseline.md`
- `docs/e2e-phase-0-validation-findings.md`
- `scripts/benchmark-e2e.mjs`
- `scripts/report-e2e-timings.mjs`

The remaining Phase 0 sections are retained as a record of the measurement method and acceptance contract.

### 0.1 Record comparable baselines

Run the full suite three times for each worker count that is relevant:

```bash
npm run test:e2e -- --workers=1
npm run test:e2e -- --workers=2
npm run test:e2e -- --workers=4
```

For each local benchmark, capture at least:

- Total wall-clock time.
- Test execution time reported by Playwright.
- Number of tests passed, failed, flaky, skipped, and retried.
- Developer machine CPU count and memory.
- Per-test and per-file duration.

The implementation agent should not treat the July 27 local run as the only baseline. It is evidence of current behavior, but final comparisons must use three-run medians on the same machine.

### 0.2 Add an opt-in local profiling command

Keep the normal `npm run test:e2e` output readable. Add an opt-in profiling mode to `playwright.config.ts`:

```ts
reporter: process.env.E2E_PROFILE
  ? [
      ['line'],
      ['json', { outputFile: 'test-results/e2e-results.json' }],
    ]
  : 'list',
```

Add a local package script:

```json
{
  "test:e2e:profile": "E2E_PROFILE=1 playwright test"
}
```

The repository currently targets local development on macOS/Linux. If Windows support is later required, replace the inline environment assignment with a cross-platform mechanism.

Optionally add `scripts/report-e2e-timings.mjs` to print:

- The 20 slowest tests.
- Duration grouped by spec file.
- Setup-hook duration when available.
- Retry count.
- Median and p95 test duration.

Do not optimize based only on file length or static wait counts once runtime timing data exists.

### 0.3 Instrument the WASM request

During a diagnostic run, listen for requests and responses whose URL contains `sql-wasm.wasm`. Record:

- Request count.
- Cache behavior.
- Median and total response duration.
- Failures or retries.

This measurement decides whether localizing the WASM asset belongs in Phase 1 or can be deferred. Given that each test has a fresh browser context and the current URL is remote, expect this to be material.

### Phase 0 acceptance criteria

- Three-run median timings exist for one, two, and four workers.
- The slowest tests and files are known.
- The benchmark machine's CPU and memory are recorded.
- WASM request time is measured.
- `npm run test:e2e:profile` produces `test-results/e2e-results.json`.
- Profiling output is ignored by Git.
- The current 142-test suite still passes.

### Phase 0 handoff contract

Phase 0 was assigned independently and delivered:

1. The opt-in `E2E_PROFILE` reporter configuration in `playwright.config.ts`.
2. The `test:e2e:profile` script in `package.json`.
3. A timing summarizer under `scripts/` if raw Playwright JSON does not make the slowest tests and per-file totals easy to review.
4. A committed `docs/e2e-local-baseline.md` containing:
   - Date and relevant machine specifications.
   - Node, npm, Playwright, and Chromium versions.
   - Individual results and three-run medians for one, two, and four workers.
   - The 20 slowest tests and per-file totals.
   - WASM request observations.
   - Failures, retries, or suspected flakes encountered during benchmarking.
   - A short ranked list of Phase 1 optimization hypotheses supported by the measurements.
5. A successful final run of the unchanged 142-test behavior suite.

Raw JSON results belong under the already ignored `test-results/` directory and should not be committed.

Phase 0 must not remove waits, change database setup, introduce seed fixtures, modify application behavior, or tune the default worker count. Those are later phases. Temporary WASM request instrumentation may be used and removed after its measurements are recorded. Any permanent diagnostic helper must be opt-in and must not affect the normal E2E command.

## Phase 1: Eliminate Deterministic Startup and Wait Costs

This phase should be completed before building more elaborate data fixtures. It is lower risk and will clarify how much runtime is genuine workflow execution.

### Approval boundary for the next implementation

The next implementation should include **Phase 1 only**. Phase 2 IndexedDB snapshots, smoke-suite selection, test migration to Vitest, CI work, and changes to the default worker count remain deferred until Phase 1 results are reviewed and separately approved.

Within Phase 1, implement the existing workstreams in this measured order:

1. **Localize SQL.js WASM** using the installed `sql.js` asset.
2. **Add deterministic app readiness and remove redundant startup cleanup** while preserving scenario-level deletion behavior.
3. **Add the narrowly gated persistence flush** for reload and persistence checks.
4. **Replace fixed synchronization sleeps** in shared helpers first, then migrate spec-local waits by measured hotspot.
5. **Re-benchmark and report** the resulting four-worker median before proposing Phase 2.

This order follows the Phase 0 evidence while keeping each change independently reversible. Do not combine all four workstreams into one unreviewable patch.

### Phase 1 implementation batches

#### Batch A: Local SQL.js WASM

Primary files:

- `src/db/sqlRuntime.ts`
- Vite environment/type declarations if required
- `tests/e2e/wasm-diagnostics.spec.ts`

Required outcome:

- Resolve `sql-wasm.wasm` from the installed `sql.js@1.13.0` package through Vite.
- Remove the jsDelivr runtime dependency from application startup.
- Update the diagnostic to assert that requests are local and that no request targets jsDelivr.
- Preserve application behavior and production base-path compatibility.

Batch validation:

- `npm run typecheck`
- `npm run build`
- WASM diagnostic
- Database cutover, import/export, program-data, regression backup/restore, and folder-backup specs
- One four-worker profiled full-suite run

#### Batch B: App readiness and startup cleanup

Primary files:

- `src/App.tsx`
- `tests/e2e/fixtures.ts` (new)
- `tests/e2e/setup.ts`
- All spec imports and startup hooks that currently call `clearDatabase(page)`

Required outcome:

- Add a stable `data-testid="app-ready"` only after database initialization completes.
- Provide one shared Playwright fixture that navigates to `/` and waits for application readiness.
- Remove startup-only database clearing because each test already receives an isolated browser context.
- Rename retained UI deletion behavior to `deleteAllProgramsViaUI`.
- Preserve mid-scenario deletion in import, restore, and isolation workflows.

Batch validation:

- `npm run typecheck`
- `npm run build`
- Home, import/export, isolation, database-cutover, and backup-related specs
- Full suite with one worker
- One four-worker profiled full-suite run

#### Batch C: Deterministic persistence

Primary files:

- `src/db/databaseService.ts`
- A narrowly scoped E2E bridge module or existing test-only initialization point
- Vite environment/type declarations
- `playwright.config.ts`
- Persistence helpers and reload tests

Required outcome:

- Expose only `flushPersistence(): Promise<void>` when `VITE_E2E=true`.
- Reuse `saveNow()` rather than duplicating persistence logic.
- Replace sleeps that exist solely to outwait the 300ms autosave debounce.
- Prove that `window.__liftlogE2E` is unavailable in a normal production build.
- Do not expose arbitrary SQL, database reset, or seed operations.

Batch validation:

- `npm run typecheck`
- Normal `npm run build` plus production-bundle check for the bridge
- Regression persistence, cardio persistence, workout reorder, summary column persistence, and direct reload scenarios
- One four-worker profiled full-suite run

#### Batch D: State-based waiting

Migrate waits in this order:

1. Shared helpers in `tests/e2e/setup.ts`.
2. `summary-statistics.spec.ts`.
3. `workout.spec.ts`.
4. `regression.spec.ts`.
5. `mesocycle.spec.ts`.
6. `workout-generator.spec.ts`.
7. Remaining specs.

For each wait, identify the state transition it was intended to protect and replace it with a locator action, locator count, URL assertion, modal visibility assertion, persistence flush, download event, or specific user-visible result. Do not mechanically delete waits without adding the relevant postcondition.

Validate each migrated file independently before moving to the next. If a wait cannot yet be replaced safely, retain it temporarily with a comment describing the missing observable signal and list it in the Phase 1 results rather than introducing a race.

### Phase 1 measurement protocol

After each batch:

1. Record one four-worker profiled full-suite result.
2. Record the slowest tests and per-file totals.
3. Compare against the Phase 0 4:33.2 median.
4. Record any failure, retry, or suspected flake.

After all Phase 1 batches:

1. Run one serial full suite to detect order dependence.
2. Run three clean four-worker profiling passes.
3. Calculate the new four-worker median.
4. Update `docs/e2e-local-baseline.md` with a clearly separated Phase 1 comparison section; do not overwrite the Phase 0 baseline.
5. Stop for owner review before beginning Phase 2.

### Detailed requirements: app readiness and startup cleanup (Batch B)

Create `tests/e2e/fixtures.ts` and extend Playwright's base test. Provide an `appPage` fixture, or override `page`, to:

1. Navigate to `/`.
2. Wait for an explicit application-ready signal.
3. Hand the ready page to the test.

The application already renders its routed UI only after `initDatabase()` resolves. Add a stable readiness locator in `src/App.tsx`, for example:

```tsx
<div className="app" data-testid="app-ready">
```

The fixture can then use:

```ts
await page.goto('/');
await expect(page.getByTestId('app-ready')).toBeVisible();
```

Change spec imports from:

```ts
import { test, expect } from '@playwright/test';
```

to:

```ts
import { test, expect } from './fixtures';
```

Remove `clearDatabase(page)` from `beforeEach` hooks where it is used only to obtain a clean test start. A fresh Playwright browser context is already empty.

Rename the old helper to `deleteAllProgramsViaUI` so its expensive behavior is explicit. Keep it only in tests where deleting data through the user interface is part of the scenario.

For mid-test technical resets that are not testing deletion:

- Prefer starting a new independent test with fresh state.
- If the reset must occur within one scenario, close the current page before clearing or restoring IndexedDB so open connections cannot block the operation.
- Do not keep a slow UI deletion loop merely as generic test cleanup.

### Detailed requirements: state-based waiting (Batch D)

Playwright locator actions and web-first assertions auto-wait. Replace `page.waitForTimeout(...)` according to the state transition caused by the previous action.

Use the following mappings in `tests/e2e/setup.ts`:

| Helper/action | Replace sleep with |
| --- | --- |
| `waitForApp` / `navigateTo` | `expect(page.getByTestId('app-ready')).toBeVisible()` plus a route-specific landmark |
| Save a program | Expect the modal to be hidden and the named program card to be visible |
| Add a mesocycle | Expect the named table row to be visible and the add form to be cleared |
| Open a mesocycle | Expect the day cells to have the requested mesocycle length |
| Add a workout | Record chip count before the action; expect count to increase and the named chip to be visible |
| Add an exercise group | Expect the named group control/sidebar item to be visible |
| Add a library exercise | Expect the named exercise row/card to be visible |
| Add a workout exercise | Expect a block containing the exact exercise and variation to be visible |
| Add a set | Record row count; expect it to increase by one |
| Edit a workout | Expect the modal to be hidden and the renamed/moved chip to be visible in the target cell |
| Copy a workout | Record matching chip count; expect it to increase in the target cell |
| Delete an item | Expect the confirmation modal to be hidden and the target locator to have count zero |
| Change summary input | Assert the specific statistic or table cell that should update |
| Import or restore | Assert the success/error alert and the resulting data state |
| Reload persistence check | Explicitly flush persistence, reload, then assert the restored value |

Use `getByRole`, `getByLabel`, and `getByTestId` for new or edited code when they provide a stable contract. Do not spend this phase rewriting every existing selector unless a selector prevents state-based waiting.

### Detailed requirements: deterministic persistence (Batch C)

`databaseService.ts` debounces writes to IndexedDB by 300 ms. Several current sleeps are attempting to wait out that debounce. A fixed 300- or 500-ms wait is both slow and susceptible to races.

Add a narrowly scoped E2E bridge that exposes only a persistence flush:

```ts
type LiftLogE2EBridge = {
  flushPersistence(): Promise<void>;
};
```

Implementation requirements:

- The bridge calls the existing `saveNow()` function.
- It is installed only when `import.meta.env.VITE_E2E === 'true'`.
- `playwright.config.ts` starts Vite with `VITE_E2E=true`.
- A normal `npm run build` must not expose `window.__liftlogE2E`.
- Add the required TypeScript `Window` declaration under the test or Vite environment types.
- Create a helper such as `flushPersistence(page)` that fails with a clear message if the bridge is absent.

Persistence tests should use:

```ts
await flushPersistence(page);
await page.reload();
await expect(page.getByTestId('app-ready')).toBeVisible();
```

Do not add general SQL execution or arbitrary database mutation to this bridge during Phase 1.

### Detailed requirements: local SQL.js WASM (Batch A)

Phase 0 confirmed a remote WASM request in every fresh diagnostic context, with a 376ms median response time. Stop using jsDelivr at runtime. Prefer making the application load the installed `sql.js` WASM asset through Vite, because this also improves offline behavior and removes a third-party runtime dependency.

Investigate this implementation first:

```ts
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
```

and pass `sqlWasmUrl` to SQL.js's `locateFile`.

If the package export map prevents that import, use a small Vite copy/public asset arrangement tied to the installed `sql.js` version. Do not manually duplicate an unversioned binary without documenting how it is updated.

Validate:

- `npm run typecheck`.
- `npm run build`.
- A local E2E run with outbound access disabled.
- The production build resolves the WASM URL correctly under the configured base path.
- Backup/export behavior is unchanged.

If changing production asset loading is out of scope, intercept the CDN URL in the E2E fixture and fulfill it from `node_modules/sql.js/dist/sql-wasm.wasm`. Treat interception as the fallback, not the preferred product architecture.

### Phase 1 acceptance criteria

- SQL.js WASM is loaded locally in development, E2E, and the production build.
- The WASM diagnostic fails if any request targets jsDelivr.
- Startup-only `clearDatabase(page)` calls are removed.
- `clearDatabase` is renamed or removed; remaining UI cleanup is scenario-specific.
- No unconditional synchronization sleeps remain.
- Reload tests flush persistence explicitly.
- The E2E bridge is absent from a normal production build and exposes no mutation capability beyond persistence flushing.
- Tests pass with one and four workers.
- The suite passes without network access to jsDelivr.
- Three final four-worker runs complete without failures, flakes, skips, or retries.
- The new four-worker median is recorded and compared with the Phase 0 4:33.2 baseline.
- The Phase 1 median is at least 25% faster than baseline (3:25 or faster), or the implementation stops for owner review with a measured explanation before Phase 2.

## Phase 2: Replace Repeated UI Arrangement with IndexedDB State Fixtures

The suite should continue to use the UI for the behavior each test is actually verifying. It does not need to use the UI to reconstruct the same prerequisite data before every assertion.

### 2.1 Prove IndexedDB snapshot compatibility

Playwright 1.61 supports IndexedDB in browser storage state. Before designing all fixtures, create a proof:

1. Start with a fresh context.
2. Create one program through the UI.
3. Flush persistence.
4. Save state using:

   ```ts
   await context.storageState({
     path: statePath,
     indexedDB: true,
   });
   ```

5. Create a new context with that `storageState`.
6. Navigate to `/`.
7. Verify that the program and its program-specific SQLite data are present.
8. Mutate the restored state in two different test contexts and verify the mutations do not leak between them.

This spike is required because LiftLog stores exported SQLite `Uint8Array` values in IndexedDB. Do not assume serialization works until the round trip passes.

### 2.2 Generate a small catalog of starting states

If the proof succeeds, add a Playwright setup project such as `tests/e2e/state.setup.ts`. It should generate only a few reusable states:

- `empty.json`: initialized empty application, if initialization itself is costly.
- `program.json`: one named program.
- `exercise-library.json`: a program with representative strength and cardio groups, exercises, and variations.
- `mesocycle.json`: the library state plus a mesocycle.
- `workout.json`: the mesocycle state plus a workout with representative exercises and sets.
- `two-programs.json`: two isolated programs for copy/isolation tests.

Generation requirements:

- Generate snapshots once per full test invocation, not once per test.
- Write them below an ignored directory such as `test-results/e2e-state/` or `.playwright/state/`.
- Do not commit generated browser storage state.
- Use deterministic names, dates, and IDs.
- Flush persistence before taking each snapshot.
- Make the Chromium project depend on the setup project.
- Keep snapshot generation assertions so a broken seed fails early and clearly.

Apply a state at the `describe` or fixture level. Each test must still receive its own browser context initialized from the immutable snapshot.

### 2.3 Introduce semantic fixtures

Expose domain-oriented fixtures rather than raw snapshot paths. Suggested fixture names:

- `emptyApp`
- `programApp`
- `libraryApp`
- `mesocycleApp`
- `workoutApp`
- `twoProgramApp`

Each fixture should return:

- The ready `page`.
- Known IDs needed for direct navigation.
- Known entity names.
- A small typed state descriptor.

Example shape:

```ts
type WorkoutState = {
  page: Page;
  programId: number;
  mesocycleId: number;
  workoutId: number;
  names: {
    program: string;
    mesocycle: string;
    workout: string;
  };
};
```

Avoid hard-coding assumed IDs such as `/mesocycles/1` throughout specs. Keep IDs in one seed descriptor so schema changes have one update point.

### 2.4 Migrate the highest-cost specs first

Migrate in this order, timing after each file:

1. `summary-statistics.spec.ts`
2. `workout.spec.ts`
3. `regression.spec.ts`
4. `mesocycle.spec.ts`
5. `workout-generator.spec.ts`
6. `isolation.spec.ts`
7. Remaining specs

Preserve UI setup only when it is the subject under test. Examples:

- A test that verifies “creates a new program via modal” must start empty and create the program through the UI.
- A test that verifies a summary calculation can start with a seeded workout and use the UI only for the mutation whose summary effect is asserted.
- A test that verifies program backup/restore must still download, mutate, restore, and assert through the user-visible workflow.

### 2.5 Fallback if IndexedDB storage state cannot round-trip SQLite bytes

Use a minimal test-only seed bridge only if the proof in 2.1 fails.

The bridge may accept a typed, versioned seed scenario and call application/domain APIs. It must not accept arbitrary SQL strings. Requirements:

- Gate it with `VITE_E2E=true`.
- Keep seed builders in test code where possible.
- Reuse production schemas and domain APIs rather than copying schema strings.
- Flush persistence before returning.
- Verify the bridge is absent from a normal production build.
- Keep at least one UI-based happy-path test for every seeded workflow.

### Phase 2 acceptance criteria

- Complex arrangement is generated once and restored into isolated contexts.
- The six hotspot specs no longer recreate identical prerequisites before every test.
- Snapshot mutation cannot leak between tests or workers.
- All persistence, import/export, and backup tests still pass.
- The full suite meets or is close to the 60% local reduction target.

## Phase 3: Tune Safe Local Parallelism

E2E execution in CI is deferred. Do not add workflows, sharding, artifact merging, or CI-specific worker configuration in this phase.

### 3.1 Benchmark local worker counts

Use the Phase 0 one-, two-, and four-worker medians to document the best local default for the benchmark machine. Preserve Playwright's automatic local worker selection unless an explicit setting is consistently faster. Developers can always override it with `--workers=N`.

Run the complete suite repeatedly with one, two, and four workers after state fixture migration. Require at least ten clean parallel runs before considering the isolation change stable.

Avoid setting workers higher than the machine can sustain. Browser-process oversubscription may increase runtime and memory pressure.

### 3.2 Document local overrides

Add examples to `docs/development.md`:

```bash
# Diagnose order dependence with serial execution
npm run test:e2e -- --workers=1

# Use an explicit local parallelism level
npm run test:e2e -- --workers=4
```

### Phase 3 acceptance criteria

- Local worker guidance is based on measured machine capacity.
- Ten consecutive parallel runs pass without state leakage.
- The normal local command retains a sensible default.
- No E2E CI workflow or requirement is added.

## Phase 4: Create Fast Feedback Lanes

This phase does not replace the full suite. It gives developers a faster signal while preserving full coverage at appropriate checkpoints.

### 4.1 Tag a smoke suite

Tag 10–15 critical tests with `@smoke`. Include at least:

- App initializes with an empty database.
- Program creation.
- Exercise library creation.
- Mesocycle and workout creation.
- Exercise and set editing.
- Persistence after reload.
- Program backup and restore.
- Exercise import/export.
- One summary-statistics check.
- One workout-generator happy path.

Add scripts:

```json
{
  "test:e2e": "playwright test",
  "test:e2e:smoke": "playwright test --grep @smoke",
  "test:e2e:changed": "playwright test --only-changed"
}
```

Before keeping `--only-changed`, verify it works correctly with the repository's Git history and shared helper dependencies. Treat it as a developer convenience, not a required merge check.

### 4.2 Define when each lane runs

Recommended policy:

- During local iteration: affected spec file or `test:e2e:changed`.
- Before handing off a UI change: smoke suite plus affected specs.
- Before locally declaring a feature complete: run the full suite when practical.
- Persistence, schema, import/export, and shared fixture changes: always run the full suite.

No lane in this phase is added as a pull-request, merge, or nightly CI check.

### Phase 4 acceptance criteria

- Smoke coverage is documented and completes in 30 seconds or less locally.
- The full suite remains available under the existing `npm run test:e2e` command.
- Documentation explains when a full run is mandatory.

## Phase 5: Move Logic Coverage Down the Test Pyramid

End-to-end tests are the most expensive way to validate pure calculations and validation rules. Add Vitest-based unit and integration coverage, then remove an E2E case only after equivalent lower-level coverage exists.

### 5.1 Best initial candidates

Move or duplicate coverage for:

- Workout generator interval, occurrence, offset, and boundary calculations.
- Summary statistic aggregation and set-type filtering.
- Set renumbering and variation-aware grouping.
- Import validation and duplicate prevention.
- Date formatting and calendar-date parsing.
- Database schema validation and migration/cutover rules.

Keep representative E2E tests proving that the UI is wired to each behavior.

### 5.2 Coverage rule

For each E2E test proposed for removal:

1. State the behavior it protects.
2. Add a lower-level test for all logic branches.
3. Identify the remaining E2E test that proves UI integration.
4. Run the full suite before and after removal.
5. Record the runtime improvement.

Do not move tests whose primary value is browser behavior, including:

- IndexedDB persistence across reload.
- File downloads and uploads.
- File System Access API behavior.
- Browser routing and direct URLs.
- Responsive layout and overflow.
- Modal focus/interaction.
- Cross-page user workflows.

### Phase 5 acceptance criteria

- Logic-heavy branches have fast lower-level coverage.
- Each feature retains at least one end-to-end integration path.
- No behavior is removed from coverage without an explicit mapping.

## File-by-File Change Guide

### `playwright.config.ts`

- Preserve the completed opt-in profiling and benchmark behavior from Phase 0.
- Add the E2E environment flag to the web server command.
- Add the setup project and dependency if IndexedDB snapshots work.
- Keep `fullyParallel: true`.
- Keep traces on first retry.
- Do not lower timeouts until waits and setup are fixed; lower them later only to fail faster on genuine hangs.

Consider testing `vite preview` against a production build after Phase 2. It may better match deployment and avoid dev-server transform work, but include build time in the end-to-end job comparison. Keep whichever has the lower total job time and the correct production behavior.

### `tests/e2e/fixtures.ts` (new)

- Own app readiness.
- Own semantic state fixtures.
- Own persistence flushing.
- Own any CDN interception fallback.
- Export `test` and `expect` so specs have one consistent import.

### `tests/e2e/state.setup.ts` (new, conditional on the spike)

- Generate versioned IndexedDB storage snapshots once per invocation.
- Assert each seed before saving it.
- Save with `indexedDB: true`.
- Keep output out of version control.

### `tests/e2e/setup.ts`

- Remove generic fixed waits.
- Rename UI helpers so their purpose is explicit.
- Make every helper return only after its observable result is ready.
- Capture before/after counts for add and copy actions.
- Add `flushPersistence`.
- Remove or rename `clearDatabase`.

### `src/App.tsx`

- Add a stable `data-testid="app-ready"` after database initialization succeeds.
- Optionally add a stable initialization-error test ID.

### `src/db/databaseService.ts` and test-only bridge

- Reuse `saveNow()` for deterministic persistence.
- Gate E2E-only exposure with `VITE_E2E`.
- Verify tree-shaking or runtime gating keeps the bridge out of normal builds.

### `src/db/sqlRuntime.ts`

- Prefer a locally bundled/resolved WASM URL.
- Retain the exact installed SQL.js version relationship.
- Validate offline startup and production base paths.

### `package.json`

- Preserve the Phase 0 profile, benchmark, and WASM diagnostic commands.
- Add smoke and optional changed-test scripts only in Phase 4.
- Add Vitest scripts only in Phase 5.

### `.gitignore`

- Ignore generated storage states and timing/report artifacts while retaining any intentionally committed test fixtures.

### `README.md` and `docs/development.md`

- Document smoke, affected, and full-suite commands.
- Document worker override behavior.
- Explain when full E2E coverage is mandatory.
- Document how to regenerate or debug state fixtures.

## Validation Matrix

Run the following after each material phase:

| Check | Purpose |
| --- | --- |
| `npm run typecheck` | Type safety for fixtures, bridge, and config |
| `npm run build` | Verify normal production build and WASM asset resolution |
| `npm run test:e2e -- --workers=1` | Detect order dependence and single-worker correctness |
| `npm run test:e2e -- --workers=4` | Detect parallel state leakage |
| Full E2E with outbound network blocked | Verify no runtime CDN dependency |
| Ten repeated parallel runs after Phase 2 | Detect intermittent isolation failures |
| Normal production build check for `window.__liftlogE2E` | Ensure test APIs are not exposed |

Also verify:

- Downloads contain non-empty, valid data.
- Imported and restored databases preserve isolation.
- A value edited immediately before reload persists after `flushPersistence`.
- Two tests starting from the same storage snapshot cannot see each other's changes.
- Folder backup mocks remain independent under parallel workers.

## Expected Impact by Optimization

These estimates are directional. Replace them with measured results after implementation.

| Optimization | Expected impact | Risk |
| --- | --- | --- |
| Remove startup UI cleanup | High | Low |
| Replace fixed waits with assertions | High | Medium; incorrect readiness signals can expose races |
| Explicitly flush debounced persistence | Medium to high | Low if narrowly gated |
| Serve SQL.js WASM locally | Modest direct wall-time reduction plus high reliability/offline value | Low to medium due build-path validation |
| Restore common IndexedDB snapshots | Very high for heavy specs | Medium; byte-array serialization must be proven |
| Tune local worker count | Already validated through four workers; revisit after state fixtures | Medium; requires isolation soak |
| Smoke/changed lanes | Very high for developer feedback | Low; does not speed the full suite |
| Move pure logic to Vitest | High long-term | Medium; requires careful coverage mapping |
| Lower retries/timeouts | Only improves broken or flaky runs | Medium; must follow reliability work |

## Risks and Mitigations

### Risk: snapshot state becomes coupled to schema versions

Generate snapshots during the test invocation instead of committing opaque JSON. Use production schema creation paths and deterministic seed assertions.

### Risk: direct state setup stops testing real workflows

Retain explicit UI tests for creation, editing, deletion, import, export, and restore. Use state fixtures only for prerequisites unrelated to the assertion.

### Risk: higher worker counts expose shared global state

Run one-worker and repeated parallel soak tests. Use immutable state snapshots and a fresh context per test. Never share a mutable page or context between tests.

### Risk: removing waits creates flakiness

Replace every wait with the exact postcondition, not merely a different generic selector. For debounced persistence, flush the pending write rather than waiting for an estimated duration.

### Risk: test-only bridge ships to users

Gate on `VITE_E2E`, verify absence in a normal production build, and keep the bridge surface minimal.

## Definition of Done

The work is complete when:

- The 142-test behavior set is preserved or every removed E2E test has a documented lower-level replacement.
- The local full-suite three-run median is at least 60% faster than the 4:33.2 Phase 0 baseline, reaching 1:49.3 or faster.
- The smoke suite completes in 30 seconds or less locally.
- No unconditional synchronization sleeps remain.
- Tests pass with one worker and the selected parallel worker count.
- Ten consecutive parallel full-suite runs pass without leakage or flakes.
- SQL.js initialization does not depend on jsDelivr during E2E execution.
- A normal production build contains no usable E2E bridge.
- Test commands and selection policy are documented.

## Open Decisions for the Owner

The E2E workflow is local-only for now; CI-provider, pull-request check, and sharding decisions are deferred.

Approval of the next implementation means:

1. Approve Phase 1 Batches A–D only.
2. Approve loading SQL.js WASM from the installed package in normal application builds, removing the jsDelivr runtime dependency.
3. Approve a minimal E2E-only `flushPersistence()` hook that is provably absent from normal production builds and exposes no arbitrary database mutation.
4. Approve the Phase 1 minimum checkpoint of 3:25 and overall target of 1:49.3.

Generated IndexedDB snapshots and Phase 2 migration are **not** included in this approval. They will be reconsidered using the measured Phase 1 result.

## Primary References

- [Playwright parallelism](https://playwright.dev/docs/test-parallel)
- [Playwright fixtures](https://playwright.dev/docs/test-fixtures)
- [Browser context isolation and IndexedDB storage state](https://playwright.dev/docs/api/class-browsercontext)
- [Playwright auto-waiting best practices](https://playwright.dev/docs/best-practices)
- [Playwright page API guidance against fixed timeout waits](https://playwright.dev/docs/api/class-page)
- [Playwright reporters](https://playwright.dev/docs/test-reporters)
