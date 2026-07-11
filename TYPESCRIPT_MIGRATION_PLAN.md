# TypeScript migration plan

## Goal and guardrails

Migrate the application and Playwright suite from JavaScript to TypeScript with
`strict: true`, without changing the database schema, API behavior, persistence
format, routes, DOM selectors, or production build output. This is a type-only
refactor: the existing SQL, IndexedDB keys, SQL.js WASM URL, and deployment
configuration must remain behaviorally identical.

The migration will be incremental at the file level, but the final state must
contain only `.ts`/`.tsx` files under `src/` and `.ts` test sources under
`tests/e2e/`.

## Current implementation inventory

| Area | Current files | Migration concern |
| --- | --- | --- |
| Application entry and routing | `src/main.jsx`, `src/App.jsx` | Type initialization/loading state and route parameters. |
| React UI | 3 components and 7 pages in `src/components/` and `src/pages/` | Explicit modal props, form state, nullable async data, route IDs, and event handlers. |
| API layer | 9 modules in `src/api/` | Define create/update/query return contracts instead of allowing untyped SQL rows to flow to pages. |
| Data layer | `src/db/databaseService.js`, `src/db/ddl.js` | SQL.js lifecycle, raw SQL values/results, IndexedDB promises, backup metadata, and legacy migration. |
| E2E suite | `tests/e2e/setup.js` and 11 `*.spec.js` files | Type Playwright `Page`, helper arguments/results, Node file-system usage, and SQL.js test usage. |
| Tooling | `package.json`, `vite.config.js`, `playwright.config.js` | Add compiler/typecheck configuration while retaining Vite and GitHub Pages behavior. |

## Target type design

Create `src/types/` as the single source of truth for domain and boundary
types. Keep database column names in the persisted-row types, then use explicit
request and view/query types where camelCase or joined fields are required.
Do not cast arbitrary SQL results directly to domain objects without a narrow
helper at the database boundary.

Suggested modules:

- `src/types/domain.ts`
  - `Program`, `Mesocycle`, `Workout`, `WorkoutSet`, `Exercise`,
    `ExerciseVariation`, and `ExerciseGroup`, mirroring the current DDL
    columns and nullability.
  - Shared aliases such as `EntityId = number`, `IsoDate = string`,
    `Nullable<T>`, and `WorkoutSetType = 'warmup' | 'normal' | 'dropset' |
    'failure'`.
  - Query/view compositions used today: `MesocycleWithWorkoutCount`,
    `ExerciseGroupWithCount`, `ExerciseWithVariations`,
    `WorkoutSetWithNames`, `WorkoutExerciseBlock`, and
    `ExerciseCopySourceGroup`.
- `src/types/api.ts`
  - Input contracts for every create/update call, including
    `CreateProgramInput`, `UpdateProgramInput`, `CreateMesocycleInput`,
    `CreateWorkoutInput`, `CreateWorkoutSetInput`, and the exercise/group/
    variation equivalents.
  - `ProgramSummary`, backup validation/result metadata, import/export JSON
    shapes, and copy-operation input/result types.
- `src/types/database.ts`
  - `SqlValue`, named SQL parameter collections, typed row records, SQL result
    sets, IndexedDB key/value and batch-operation contracts, and the
    database-service public interface.
  - A `BackupMetadata` type that captures the current keys (`program_name`,
    `program_notes`, `program_created_at`, `format_version`, `backup_type`,
    `source_program_id`, and `exported_at`) as optional values while parsing,
    then a validated form after verification.
- `src/types/sql.js.d.ts`
  - A minimal local declaration for the exact SQL.js surface used here:
    default `initSqlJs`, `SqlJsStatic`, `Database`, `Statement`, `exec`,
    `run`, `prepare`, `bind`, `step`, `getAsObject`, `export`, `close`, and
    `locateFile` configuration. Model returned cell values as the project
    `SqlValue` union rather than `any`.
- `src/types/vite-env.d.ts`
  - Vite client declarations plus `__BUILD_DATE__`, `__APP_VERSION__`, and
    the temporary `window.__sqlJs` debug field used by `databaseService`.

Use relative imports initially (`../types/domain`) to avoid adding an alias
that changes resolution behavior. A `baseUrl`/`paths` alias can be added only
after the migration is green, and only if it is configured consistently for
TypeScript, Vite, and test tooling.

## Implementation sequence

1. Establish a reproducible baseline.
   - Record the current `npm run build` and `npm run test:e2e` result before
     modifications.
   - Preserve the current Pages `base` behavior and the SQL.js CDN `locateFile`
     URL; neither belongs to this type-only change.
   - Add `typescript` as a development dependency. Add `@types/node` because
     the E2E suite imports `fs`; retain the package-provided React Bootstrap,
     React Router, and Playwright types.
   - Add a `typecheck` script: `tsc --noEmit`. Keep `build` as `vite build` so
     its emitted assets and deployment command remain unchanged; make CI/run
     documentation invoke both commands explicitly.

2. Configure TypeScript for the transitional and final states.
   - Add `tsconfig.json` with `target`/`module` set to `ESNext`,
     `moduleResolution: 'bundler'`, `jsx: 'react-jsx'`,
     `lib: ['DOM', 'DOM.Iterable', 'ESNext']`, `strict: true`,
     `noEmit: true`, and `allowJs: true`.
   - Include `src`, `tests/e2e`, `vite.config.ts`, and
     `playwright.config.ts`; exclude generated output and dependencies.
   - Prefer `verbatimModuleSyntax` and `isolatedModules` once all source files
     are converted. Resolve resulting type-only imports using `import type`.
   - Configure `types: ['node']` if needed for configuration and test files.
     Do not set `skipLibCheck` unless a specific external declaration defect is
     documented; the goal is meaningful strict checking.

3. Add the type boundary before converting implementation modules.
   - Implement the `src/types/` modules above from `src/db/ddl.js` and the SQL
     projections in `src/api/`. In particular, retain snake_case storage
     fields (`microcycle_length`, `exercise_group_id`, `is_primary`, etc.) and
     nullable fields (`notes`, URLs, variation IDs, reps, weight, and RIR).
   - Add narrow conversion/assertion helpers in the data layer for dynamic
     SQL.js rows and scalar query results. They should validate or normalize
     `SqlValue` at the edge, not make downstream pages handle `Record<string,
     unknown>`.
   - Add a small `DatabaseStore`/catalog contract for active program state,
     binary exported databases (`Uint8Array`), IndexedDB records, queued
     activation, and IDB batch operations.

4. Convert and type the database layer first.
   - Rename `src/db/ddl.js` to `src/db/ddl.ts` and type the schema version and
     SQL constants.
   - Rename `src/db/databaseService.js` to `src/db/databaseService.ts`.
     Type SQL.js initialization, nullable singleton databases, active program
     ID, timer handle, `Promise` queue, `IDBRequest` event targets, and every
     exported helper.
   - Type query helpers generically (for example `queryAll<T extends SqlRow>`)
     while keeping SQL strings and result values unchanged. Use concrete return
     types at callers rather than permitting unconstrained generic assertions.
   - Type backup import/export buffers and validation results, and ensure
     database handles are closed along the same branches as today. Preserve
     migration logic, schema validation, IDB keys, and the single-transaction
     backup restore behavior exactly.

5. Convert the API layer and make its contracts enforceable.
   - Rename all nine API modules to `.ts`: `programsApi`, `mesocyclesApi`,
     `workoutsApi`, `workoutSetsApi`, `exerciseGroupsApi`, `exercisesApi`,
     `exerciseVariationsApi`, `summaryApi`, and `copyApi`.
   - Apply input and return types to every API method. APIs that may not find a
     row return `T | null`; mutations that currently return nothing remain
     `void`/`Promise<void>` rather than inventing a response.
   - Explicitly type joined rows and projections, including exercise counts,
     workout counts, workout blocks/sets, and source exercise groups for copy.
     Type `idMap`/`groupMap` as numeric maps instead of loose objects.
   - Keep current public method names, SQL statements, ordering, defaults,
     null coalescing, and async behavior unchanged so UI callers and backups
     retain identical behavior.

6. Convert the React entry points, components, and pages.
   - Rename `src/main.jsx` and `src/App.jsx` to `.tsx`; type initialisation
     errors and loading state, then replace all local relative imports for the
     renamed modules.
   - Rename the three components to `.tsx` and `components/index.js` to
     `index.ts`. Define `FormModalProps` and `ConfirmModalProps` with
     `ReactNode`, callback signatures, optional labels, and the existing
     Bootstrap variant value type.
   - Rename all seven pages to `.tsx`. Type state explicitly where inference
     would otherwise lock arrays to `never[]`, objects to incomplete literals,
     or async state to `null` only. Parse/validate route parameters at the
     router boundary before passing them to numeric API methods.
   - Use React event types for form, input, select, file, and button handlers;
     preserve the existing string-to-number conversion and validation behavior.
     Type `Set<number>`/record state for selected IDs, expanded sections, and
     variation lookups.

7. Convert build configuration and the E2E suite.
   - Rename `vite.config.js` and `playwright.config.js` to `.ts`, retaining
     their current exported configuration and all runtime settings.
   - Rename `tests/e2e/setup.js` to `setup.ts` and every `*.spec.js` to
     `*.spec.ts`. Update local imports to `./setup` without extensions so the
     suite continues to work after conversion.
   - Type shared helper parameters as Playwright `Page`, options as explicit
     interfaces, and return values (notably `Promise<number | null>` from
     `seedProgramViaUI`). Use typed Node imports for `fs` and import SQL.js
     through the local declaration where tests inspect database backups.
   - Do not alter test selectors, test data, waits, or assertions as part of
     the extension change; any behavior failure is a migration regression to
     investigate separately.

8. Tighten, validate, and finalize.
   - Remove remaining JavaScript source files from `src/` only after their
     TypeScript replacements compile; `allowJs` can then be removed or set to
     `false` as an enforceable completion check.
   - Run formatter/lint tooling only if it already exists or is explicitly
     introduced as a separate change. Avoid broad formatting churn.
   - Update any project documentation with the `npm run typecheck` command
     and migration conventions for new domain/API types.

## File-level rename checklist

```text
src/App.jsx                              -> src/App.tsx
src/main.jsx                             -> src/main.tsx
src/components/{ConfirmModal,FormModal,Navigation}.jsx -> .tsx
src/components/index.js                  -> src/components/index.ts
src/pages/*.jsx                          -> src/pages/*.tsx
src/api/*.js                             -> src/api/*.ts
src/db/{databaseService,ddl}.js          -> .ts
vite.config.js                           -> vite.config.ts
playwright.config.js                     -> playwright.config.ts
tests/e2e/setup.js                       -> tests/e2e/setup.ts
tests/e2e/*.spec.js                      -> tests/e2e/*.spec.ts
```

## Verification and acceptance gates

Run the following after each major layer and again when all renames are
complete:

1. `npm run typecheck` — passes with `strict: true` and no errors.
2. `npm run build` — succeeds and inspect the resulting `dist/` assets for the
   existing production base path and normal Vite output.
3. `npm run test:e2e` — all renamed Playwright specs pass, including
   import/export, program isolation, copy, and full backup restore coverage.
4. `npm run dev` — starts normally; manually verify initial database loading,
   program creation, navigation, exercise/set editing, and a backup
   import/export round-trip without HMR/type failures.
5. `git diff --check` and extension audits:
   `find src -type f \( -name '*.js' -o -name '*.jsx' \)` and
   `find tests/e2e -type f -name '*.spec.js'` must return no source/spec
   files. Confirm that each required domain type is defined in `src/types/`
   and imported by the API, DB, and UI layers that consume it.

## Risks and decisions to resolve during implementation

- SQL.js results are dynamic. Limit unavoidable assertions to one audited
  database boundary and never use broad `any`/double casts in API or UI code.
- SQLite boolean-like fields are stored as numeric `0`/`1`; model persisted
  rows that way, with optional UI-level booleans only where a conversion is
  explicit.
- Route parameters and form inputs are strings even when IDs and values are
  numeric. Preserve current parsing/default behavior and make invalid/missing
  values explicit rather than silently widening API IDs to `string | number`.
- Vite transpiles TypeScript but does not enforce type errors by itself. The
  separate `typecheck` gate is therefore required for the stated acceptance
  criteria; it should be added to the project’s normal local/CI verification.
- The existing SQL.js WASM CDN resolution and GitHub Pages base path are known
  runtime-sensitive surfaces. Treat them as regression checks, not as
  opportunities for cleanup in this migration.
