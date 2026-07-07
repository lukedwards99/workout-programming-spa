# Technical Specification — Workout Programming SPA v3

## 1. Overview

A single-page React application for tracking weightlifting workouts. All data lives
in a browser-side SQLite database (sql.js) persisted to IndexedDB. The user can
export the full database as a binary blob for backup and transfer between devices.

## 2. Technology Stack

| Layer              | Choice                      | Notes                                                                 |
|--------------------|-----------------------------|-----------------------------------------------------------------------|
| UI framework       | React 19+                   | Functional components + hooks                                         |
| Routing            | React Router v7+            | Client-side hash or history router                                    |
| CSS                | Bootstrap 5 + custom CSS    | Bootstrap for layout/forms/tables; custom for workout-specific styles |
| SQL engine         | sql.js (1.x)                | Compiles SQLite to WebAssembly; runs fully in browser                 |
| Persistence        | IndexedDB                   | Binary SQLite database stored via IndexedDB key-value store           |
| Build tooling      | Vite                        | Fast dev server and production bundling                               |
| Data export/import | FileReader / Blob API       | Binary `.sqlite` file download and upload                             |

## 3. Database Schema (SQLite)

All tables use `INTEGER PRIMARY KEY` (auto-increment alias for `rowid`).
Foreign keys are enforced via `PRAGMA foreign_keys = ON`.

```sql
-- Top-level training plan (e.g. "Push/Pull/Legs 2025")
CREATE TABLE programs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL UNIQUE,
    notes         TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- A training block within a program (e.g. "4-Week Strength Block")
CREATE TABLE mesocycles (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    program_id        INTEGER NOT NULL,
    name              TEXT    NOT NULL,
    microcycle_length INTEGER NOT NULL DEFAULT 7,
    start_date        TEXT    NOT NULL,
    notes             TEXT,
    sort_order        INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
);

-- A single workout session (e.g. "Push Day A")
CREATE TABLE workouts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    mesocycle_id  INTEGER NOT NULL,
    name          TEXT    NOT NULL,
    day_offset    INTEGER NOT NULL,
    notes         TEXT,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (mesocycle_id) REFERENCES mesocycles(id) ON DELETE CASCADE
);

-- Muscle group / category (e.g. "Chest", "Back", "Legs")
CREATE TABLE exercise_groups (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    name    TEXT    NOT NULL UNIQUE,
    notes   TEXT
);

-- Individual exercise (e.g. "Barbell Bench Press")
CREATE TABLE exercises (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_group_id INTEGER NOT NULL,
    name              TEXT    NOT NULL,
    tutorial_url      TEXT,
    notes             TEXT,
    FOREIGN KEY (exercise_group_id) REFERENCES exercise_groups(id) ON DELETE CASCADE
);

-- A variation of an exercise (e.g. "Close-Grip Bench Press")
CREATE TABLE exercise_variations (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_id   INTEGER NOT NULL,
    name          TEXT    NOT NULL,
    is_primary    INTEGER NOT NULL DEFAULT 0,
    tutorial_url  TEXT,
    notes         TEXT,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);

-- Sets performed during a workout
CREATE TABLE workout_sets (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id            INTEGER NOT NULL,
    exercise_id           INTEGER NOT NULL,
    exercise_variation_id INTEGER,
    exercise_order        INTEGER NOT NULL,
    set_number            INTEGER NOT NULL,
    set_type              TEXT    NOT NULL DEFAULT 'normal',
    reps                  INTEGER,
    weight                REAL,
    rir                   INTEGER,
    notes                 TEXT,
    FOREIGN KEY (workout_id)            REFERENCES workouts(id)             ON DELETE CASCADE,
    FOREIGN KEY (exercise_id)           REFERENCES exercises(id)            ON DELETE CASCADE,
    FOREIGN KEY (exercise_variation_id) REFERENCES exercise_variations(id)  ON DELETE SET NULL
);
```

### Set Types (`set_type` column)

| Value     | Meaning                                                  |
|-----------|----------------------------------------------------------|
| `warmup`  | Warm-up set (lighter weight, not counted for volume)     |
| `normal`  | Standard working set                                     |
| `dropset` | Drop set (reduced weight after failure)                  |
| `failure` | Set taken to absolute failure                            |

### Key Design Decisions

- **No fixed 7-day week table.** The old `days` table is gone. Workouts use `day_offset`
  (0-based) within a mesocycle's `microcycle_length`. This supports mesocycles of any length
  (4-day, 7-day, 10-day rotations, etc.).
- **Decimal weight support.** `weight` is `REAL` to allow fractional plates (kg or lb).
- **Program → Mesocycle → Workout** hierarchy with cascade deletes.
- **Exercise variations** are optional; a set may reference one or fall back to the base exercise.
- **Export format** is the raw SQLite binary blob (`.sqlite`), *not* CSV.

## 4. Persistence & Data Export/Import

### Runtime Persistence

```
┌─────────────────────────────────────────────────────┐
│  React App                                          │
│    │                                                 │
│    ▼                                                 │
│  sql.js  ─── in-memory SQLite database              │
│    │                                                 │
│    ▼                                                 │
│  IndexedDB  ─── persisted binary blob (keyed by     │
│                 schema version)                      │
└─────────────────────────────────────────────────────┘
```

On app start:
1. Load sql.js WebAssembly.
2. Try to read the stored SQLite binary from IndexedDB.
3. If found, restore it into sql.js. If not, create a fresh database and run DDL.
4. On every mutation (create/update/delete), auto-save the binary back to IndexedDB.

### Export

- User clicks "Export Database".
- App calls `db.export()` to get a `Uint8Array` of the current SQLite database.
- A `<Blob>` is created and downloaded via a temporary `<a>` element.
- Filename: `workout-data-backup.sqlite`.

### Import

- User clicks "Import Database", selects a `.sqlite` file.
- FileReader reads the file as `ArrayBuffer`.
- The buffer is loaded into sql.js via `new SQL.Database(new Uint8Array(buffer))`.
- Schema version is validated (by checking a pragma or a custom metadata table).
- If valid, the database replaces the current one and is saved to IndexedDB.
- User is warned that current data will be overwritten.

### Future: Server-Side Backup

Not implemented yet. Planned approach:
- POST the binary SQLite blob to an authenticated API endpoint.
- Server stores it in S3/R2 with user-id key.
- Client can fetch the latest backup and restore.

## 5. Component & Page Structure

```
App
├── Navigation          (top bar / sidebar with page links)
├── HomePage            /                          — list programs
├── ProgramPage         /programs/:programId       — list mesocycles
├── MesocyclePage       /mesocycles/:mesocycleId   — weekly calendar view
├── WorkoutPage         /workouts/:workoutId       — exercises + sets
├── ExerciseLibraryPage /exercises                 — manage groups & exercises
└── DataManagementPage  /data                      — export/import
```

## 6. Page Functionality Detail

### 6.1 Home Page (`/`)

- Displays all programs as cards in a grid.
- "New Program" button opens an inline form or modal.
- Each program card shows name, note preview, and counts: "3 mesocycles".
- Actions: View (navigates to ProgramPage), Edit (inline), Delete (with confirmation).
- Empty state: "No programs yet. Create your first training program."

### 6.2 Program Page (`/programs/:programId`)

- Breadcrumb: Home > Program Name.
- Shows program name, notes, and a table of mesocycles.
- "New Mesocycle" form: name, microcycle length (default 7), start date.
- Each mesocycle row: name, length, start date, workout count, actions.
- Actions: View (navigates to MesocyclePage), Edit, Delete.

### 6.3 Mesocycle Page (`/mesocycles/:mesocycleId`)

- Breadcrumb: Home > Program Name > Mesocycle Name.
- Visual "calendar" grid showing the microcycle.
- Columns: Day 1, Day 2, ... Day N (based on microcycle_length).
- Each cell shows workout name(s) assigned to that day.
- "Add Workout" on an empty day cell, or on existing ones.
- Click workout name to navigate to WorkoutPage.

### 6.4 Workout Page (`/workouts/:workoutId`)

- Breadcrumb: Home > Program > Mesocycle > Workout Name.
- **Exercise list** — ordered list of exercises for this workout.
- Each exercise shows:
  - Exercise name and variation (if selected).
  - A table of sets: set #, type (warmup/normal/dropset/failure), reps, weight, RIR, notes.
  - Inline add/edit/delete for sets.
- "Add Exercise" button opens a search/select modal or dropdown to pick from the
  exercise library and optionally choose a variation.
- Reorder exercises via drag handles or up/down buttons.
- Auto-calculated totals at the bottom: total sets, total volume (reps × weight).

### 6.5 Exercise Library Page (`/exercises`)

- Two-column layout or tabbed: Exercise Groups | Exercises.
- **Exercise Groups** panel:
  - List of groups (Chest, Back, Legs, etc.).
  - Add/Edit/Delete group.
- **Exercises** panel:
  - Filtered by selected group (or "All").
  - List of exercises with name, tutorial URL, variations count.
  - Add/Edit/Delete exercise.
  - Click an exercise to expand and see/manage its variations.
- Search bar to filter exercises by name.

### 6.6 Data Management Page (`/data`)

- **Export section**: button to download current database as `.sqlite` binary.
- **Import section**: file input to upload a `.sqlite` file.
  - Confirmation dialog warning about overwriting current data.
  - On import, verify file is valid SQLite and replace current DB.
- Status messages for success/error.

## 7. API Layer Design

A plain-js API module (no HTTP — direct calls to sql.js):

```js
// Example pattern
import { getDb } from '../db/databaseService';

export const programsApi = {
  list()      { /* SELECT * FROM programs ORDER BY created_at DESC */ },
  get(id)     { /* SELECT * FROM programs WHERE id = ? */ },
  create(data){ /* INSERT INTO programs ... */ },
  update(id, data) { /* UPDATE programs SET ... WHERE id = ? */ },
  delete(id)  { /* DELETE FROM programs WHERE id = ? */ },
};
```

Separate API files for each entity: `programsApi`, `mesocyclesApi`, `workoutsApi`,
`exercisesApi`, `exerciseGroupsApi`, `exerciseVariationsApi`, `workoutSetsApi`.

Each function:
1. Takes validated input.
2. Runs SQL via `getDb().run()` or `getDb().exec()`.
3. Returns `{ success: true, data }` or `{ success: false, error }`.
4. Triggers auto-save to IndexedDB after write operations.

## 8. Schema Migration Strategy

A `schema_version` table:

```sql
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY
);
```

On app start, check `SELECT MAX(version) FROM schema_version`. If < current,
run migration SQL in order. Migrations are numbered SQL files/strings applied
sequentially. This avoids data loss when the schema changes across app versions.
