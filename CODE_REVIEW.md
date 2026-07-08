# Code Review Findings

Review date: 2026-07-08

Scope: fresh-build review of the current codebase, followed by a latest-commit review of `9ac8db4` (`fix: address all code review findings...`).

Verification:
- `npm run build` passed.
- Initial fresh-build review: `npm run test:e2e` passed after allowing Playwright to start the local Vite server: 58 passed, 1 skipped.
- Latest commit review: `npm run test:e2e` passed after allowing Playwright to start the local Vite server: 64 passed, 1 skipped.

## Priority Legend

- P0: Release blocker / data-loss risk requiring immediate fix.
- P1: High-impact bug likely to affect normal use.
- P2: Important reliability, correctness, or maintainability issue.
- P3: Lower-risk improvement.

## Findings

## Latest Commit Findings

These are the remaining findings from the follow-up review of commit `9ac8db4`.

### P1 - Variation-specific set deletion still renumbers across every variation block

References:
- `src/pages/WorkoutPage.jsx:102`
- `src/api/workoutSetsApi.js:53`

The latest commit made workout blocks variation-aware, but `handleDeleteSet` still calls `workoutSetsApi.renumber(id, set.exercise_id)`, and `renumber` scopes only by `workout_id + exercise_id`. If the same exercise is present in multiple blocks, such as "Bench Press", "Bench Press - Close Grip", and "Bench Press - Wide Grip", deleting a set from one block will renumber sets across all of those blocks together.

That leaves per-block set numbering incorrect and can make two separate variation blocks appear to share a single set sequence.

Recommendation:
- Update `renumber` to accept `exerciseVariationId` and scope by `exercise_variation_id = ?` or `exercise_variation_id IS NULL`.
- Pass the deleted set's `exercise_variation_id` from `handleDeleteSet`.
- Add a regression test with the same exercise in two variation blocks, multiple sets in each, then delete from one block and assert both blocks still have independent `1, 2, ...` numbering.

### P2 - Failed full database import can restore a closed database handle

References:
- `src/db/databaseService.js:189`
- `src/db/databaseService.js:191`
- `src/db/databaseService.js:192`
- `src/db/databaseService.js:226`

The import path saves `oldDb`, assigns `db = newDb`, then immediately closes `oldDb` before migration and `saveToIndexedDB()` have completed. If a later step throws, the catch block assigns `db = oldDb`, but that handle has already been closed.

The user-facing error says the database is unchanged, but the app can be left pointing at a closed in-memory database until reload.

Recommendation:
- Keep `oldDb` open until the new database has passed validation, any migration, and the IndexedDB save.
- Only close `oldDb` after the new DB is fully committed.
- If import fails, close `newDb`, restore the still-open `oldDb`, and preserve the original error or include it in the thrown message.

### P2 - Full database import still accepts malformed schema-versioned SQLite files

References:
- `src/db/databaseService.js:177`
- `src/db/databaseService.js:184`
- `src/db/databaseService.js:226`

The import flow now rejects future schema versions, which is good, but it still treats any SQLite file with a compatible `schema_version` row as valid app data. A file with `schema_version = 2` but missing required tables or columns can be assigned to `db`, saved to IndexedDB, and then fail later on normal app screens.

Recommendation:
- Before assigning or saving the imported database, validate required tables and columns for the supported schema.
- At minimum, check `programs`, `mesocycles`, `workouts`, `exercise_groups`, `exercises`, `exercise_variations`, and `workout_sets` plus the columns the API reads/writes.
- Add a test that imports a SQLite file with `schema_version = 2` but missing a required table and asserts the existing app data remains usable.

### P2 - Duplicate exercise/variation workout blocks still collide

References:
- `src/api/workoutsApi.js:33`
- `src/api/workoutsApi.js:64`
- `src/pages/WorkoutPage.jsx:172`

Variation-aware grouping now uses `blockId: ${exercise_id}-${block_variation_id}`. This handles one no-variation block and one block per variation, but adding the same exercise with the same variation twice still creates duplicate blocks with the same `blockId`. Each duplicate block then queries the same combined set list, and React receives duplicate keys.

Recommendation:
- Decide whether duplicate `(exercise_id, exercise_variation_id)` blocks are allowed.
- If duplicates are not allowed, prevent adding an exercise/variation combination that already exists in the workout and surface a friendly message.
- If duplicates are allowed, introduce a real workout-exercise/workout-block entity or another stable block identity instead of deriving identity from only exercise and variation.
- Add a regression test for attempting to add the same exercise/variation twice.

## Original Fresh-Build Findings

These findings were identified in the initial fresh-build review. The latest commit addressed many of them, but they are preserved here for historical context and to show the original recommendation trail.

### P1 - Editing a set can overwrite required set fields or fail the update

References:
- `src/pages/WorkoutPage.jsx:88`
- `src/api/workoutSetsApi.js:26`

`WorkoutPage` updates a single field by building a partial object such as `{ reps: "8" }`, then passes it to `workoutSetsApi.update`. The API method destructures the object as if every persisted column is present and writes all columns back:

```js
UPDATE workout_sets SET set_number = ?, set_type = ?, reps = ?, weight = ?, rir = ?, notes = ? WHERE id = ?
```

For a normal reps edit, `setNumber` and `setType` are `undefined`, and nullable fields that were not edited are written as `null`. At best, this drops existing values; at worst, SQLite rejects the update because `set_number` and `set_type` are `NOT NULL`.

Recommendation:
- Change `workoutSetsApi.update` into a true patch update that reads the existing row first and merges fields, or add a separate `patch(id, changes)` method that only updates provided columns.
- Convert numeric input strings to numbers or `null` at the boundary.
- Add an E2E test that fills reps, weight, RIR, and notes in sequence and asserts all values remain visible after reload.

### P1 - SQLite foreign-key cascades are not enabled after loading or importing a database

References:
- `src/db/databaseService.js:65`
- `src/db/databaseService.js:121`
- `src/db/databaseService.js:162`
- `src/db/ddl.js:3`

`PRAGMA foreign_keys = ON` is included in the initial schema SQL, so new in-memory databases get enforcement during that initial connection. SQLite foreign-key enforcement is connection-local, though. When a saved database is loaded from IndexedDB or a full backup is imported, the code creates a new `sql.Database(...)` but does not re-enable foreign keys.

That means cascades such as deleting a program, mesocycle, group, exercise, or workout may leave orphan rows after an app reload or full import. This can corrupt counts, stale workout sets, and future joins.

Recommendation:
- Immediately run `db.run('PRAGMA foreign_keys = ON')` after every `new sql.Database(...)`, including new, saved, migrated, and imported database paths.
- Add a regression test that reloads the app, deletes a parent record, and verifies child rows are removed.

### P1 - Program summary counts mix program-scoped and global data

References:
- `src/api/summaryApi.js:4`
- `src/api/summaryApi.js:17`
- `src/pages/ProgramDataPage.jsx:175`

`summaryApi.getStats(programId)` correctly scopes exercise groups and exercises to the selected program, but it returns global counts for mesocycles, workouts, and sets. On a multi-program database, the Data tab for one program will show other programs' mesocycles, workouts, and sets.

Recommendation:
- When `programId` is provided, scope:
  - mesocycles with `WHERE program_id = ?`
  - workouts by joining through `mesocycles`
  - sets by joining through `workouts -> mesocycles`
- Add a test with two programs to confirm each Data tab reports only its own counts.

### P1 - Adding the same exercise with multiple variations conflates workout blocks

References:
- `src/api/workoutsApi.js:31`
- `src/api/workoutsApi.js:45`
- `src/pages/WorkoutPage.jsx:74`
- `src/pages/WorkoutPage.jsx:100`
- `src/pages/WorkoutPage.jsx:160`

Workout display groups sets by `exercise_id`, but the schema allows `exercise_variation_id` per set. If a user adds the same exercise twice with different variations, `getExercisesWithSets` can return multiple distinct block rows, then each block queries all sets for the same exercise regardless of variation. The UI also keys blocks by `exercise_id`, so duplicate exercise blocks collide in React. Follow-up actions use only `exercise_id`, so adding a set loses the variation (`exerciseVariationId: null`), and removing one block deletes every set for that exercise in the workout.

Recommendation:
- Decide the domain model: either a workout block is `(exercise_id, exercise_variation_id)` or a separate workout-exercise entity.
- If keeping the current schema, group and query sets by both `exercise_id` and `exercise_variation_id`, use a composite/stable key, carry the block variation into added sets, and delete by the same block identity.
- Add tests for adding the same exercise twice with two variations, adding a set to each, and removing only one variation block.

### P2 - Deleting a set does not renumber remaining sets

References:
- `src/pages/WorkoutPage.jsx:95`
- `src/api/workoutSetsApi.js:42`

There is a `renumber` helper, but `handleDeleteSet` does not call it. If a user deletes set 1 from a three-set exercise, the UI can show sets 2 and 3 instead of 1 and 2.

Recommendation:
- After deleting a set, renumber the relevant exercise block. If workout blocks become variation-specific, renumber within the block identity.
- Add a test that deletes a middle set and verifies visible set numbers are contiguous.

### P2 - Full database import accepts incompatible schema versions too broadly

References:
- `src/db/databaseService.js:150`
- `src/db/databaseService.js:163`

Full import verifies the SQLite file header and checks that `schema_version` has a value, but it does not require the imported version to match a supported schema or run migrations. A future or malformed app database with `schema_version` present can replace the user's current database and fail later on normal screens.

Recommendation:
- Accept only known schema versions and migrate older supported versions before assigning `db = newDb`.
- Validate required tables/columns before saving the imported database to IndexedDB.
- Consider backing up the existing DB in memory until the imported DB has passed validation and initial queries.

### P2 - `sql.js` loads the WASM file from an external CDN at runtime

Reference:
- `src/db/databaseService.js:18`

`loadSqlJs` resolves the WASM asset from `https://sql.js.org/dist/...`. A production build can therefore fail to initialize when offline, behind restrictive networks, or if the CDN changes availability. Since this app is browser-local and data-centric, startup should not depend on a third-party runtime fetch.

Recommendation:
- Serve the `sql-wasm.wasm` asset from the app bundle or `public/` directory and point `locateFile` at that local URL.
- Add a smoke test or build check that confirms the WASM file is present in the production artifact.

### P2 - Save durability depends on a delayed autosave that is not always flushed

References:
- `src/db/databaseService.js:129`
- `src/db/databaseService.js:194`

Most mutations call `execSQL`, which schedules a save 300 ms later. If the user edits data and immediately closes the tab, navigates away, or the browser suspends the page before the timer fires, the latest change can be lost. `saveNow` exists but is not wired into lifecycle events or critical operations.

Recommendation:
- Flush pending saves on `visibilitychange` and `pagehide`.
- Consider awaiting `saveNow` for destructive actions and import/export flows.
- Add a small dirty-state indicator or at least centralized save error reporting.

### P3 - Program JSON import can create duplicate exercises on repeated import

References:
- `src/pages/ProgramDataPage.jsx:95`
- `src/pages/ProgramDataPage.jsx:99`

Exercise groups are merged by name, but exercises are always inserted. Re-importing the same program export creates duplicate exercises and duplicate variations inside the reused group.

Recommendation:
- Either make repeated imports explicitly additive in the UI copy, or de-duplicate by group name plus exercise name, with a clear conflict policy.
- Add tests for importing the same file twice.

### P3 - Duplicate primary variations are allowed

References:
- `src/api/exerciseVariationsApi.js:18`
- `src/pages/ProgramExercisesPage.jsx:116`

The app marks the first variation as primary when adding from the library UI, but the database and API do not enforce one primary variation per exercise. Imports and copy operations can bring in multiple `is_primary` rows.

Recommendation:
- Enforce a single primary variation per exercise in API operations, or remove the primary concept if it is only decorative.
- Add a uniqueness strategy, such as clearing existing primary flags before setting a new one.

### P3 - Test coverage is happy-path heavy around the riskiest workflows

References:
- `tests/e2e/workout.spec.js:67`
- `tests/e2e/program-data.spec.js:20`

The existing E2E suite is valuable and passing, but several high-risk paths are not asserted deeply enough: set value persistence, cascade behavior after reload/import, per-program stats with multiple programs, variation-specific workout blocks, and repeated imports.

Recommendation:
- Add focused regression tests for the P1/P2 findings above before larger UI work.
- Prefer assertions after page reload for persistence-sensitive features.
