export const SCHEMA_VERSION: number = 5;

export const createCatalogSQL: string = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS programs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE,
    notes      TEXT,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO schema_version (version) VALUES (${SCHEMA_VERSION});
`;

export const createProgramSQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS mesocycles (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT    NOT NULL,
    mesocycle_length INTEGER NOT NULL DEFAULT 7 CHECK(mesocycle_length > 0),
    start_date       TEXT    NOT NULL,
    notes            TEXT,
    sort_order       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS workouts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    mesocycle_id  INTEGER NOT NULL,
    name          TEXT    NOT NULL,
    day_offset    INTEGER NOT NULL CHECK(day_offset >= 0),
    notes         TEXT,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (mesocycle_id) REFERENCES mesocycles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS exercise_groups (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT    NOT NULL,
    notes TEXT,
    UNIQUE(name)
);

CREATE TABLE IF NOT EXISTS exercises (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_group_id INTEGER NOT NULL,
    name              TEXT    NOT NULL,
    tutorial_url      TEXT,
    notes             TEXT,
    FOREIGN KEY (exercise_group_id) REFERENCES exercise_groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS exercise_variations (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_id  INTEGER NOT NULL,
    name         TEXT    NOT NULL,
    is_primary   INTEGER NOT NULL DEFAULT 0,
    tutorial_url TEXT,
    notes        TEXT,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workout_sets (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id            INTEGER NOT NULL,
    exercise_id           INTEGER NOT NULL,
    exercise_variation_id INTEGER,
    exercise_order        INTEGER NOT NULL CHECK(exercise_order >= 0),
    set_number            INTEGER NOT NULL CHECK(set_number >= 1),
    set_type              TEXT    NOT NULL DEFAULT 'normal' CHECK(set_type IN ('warmup', 'normal', 'dropset', 'failure')),
    reps                  INTEGER CHECK(reps >= 0),
    weight                REAL CHECK(weight >= 0),
    rir                   INTEGER,
    notes                 TEXT,
    FOREIGN KEY (workout_id)            REFERENCES workouts(id)             ON DELETE CASCADE,
    FOREIGN KEY (exercise_id)           REFERENCES exercises(id)            ON DELETE CASCADE,
    FOREIGN KEY (exercise_variation_id) REFERENCES exercise_variations(id)  ON DELETE SET NULL
);

-- Indexes for foreign-key and query columns
CREATE INDEX IF NOT EXISTS idx_mesocycles_sort_start ON mesocycles(sort_order, start_date);
CREATE INDEX IF NOT EXISTS idx_workouts_mesocycle_id ON workouts(mesocycle_id);
CREATE INDEX IF NOT EXISTS idx_workouts_mesocycle_sort ON workouts(mesocycle_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_exercises_group_id ON exercises(exercise_group_id);
CREATE INDEX IF NOT EXISTS idx_exercise_variations_exercise_id ON exercise_variations(exercise_id);
CREATE INDEX IF NOT EXISTS idx_workout_sets_workout_id ON workout_sets(workout_id);
CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise_id ON workout_sets(exercise_id);
CREATE INDEX IF NOT EXISTS idx_workout_sets_variation_id ON workout_sets(exercise_variation_id);
CREATE INDEX IF NOT EXISTS idx_workout_sets_workout_order ON workout_sets(workout_id, exercise_order, set_number);
CREATE INDEX IF NOT EXISTS idx_workout_sets_set_type ON workout_sets(set_type);

INSERT OR IGNORE INTO schema_version (version) VALUES (${SCHEMA_VERSION});
`;
