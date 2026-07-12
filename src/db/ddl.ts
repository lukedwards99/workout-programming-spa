export const SCHEMA_VERSION: number = 4;

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
    mesocycle_length INTEGER NOT NULL DEFAULT 7,
    start_date       TEXT    NOT NULL,
    notes            TEXT,
    sort_order       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS workouts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    mesocycle_id  INTEGER NOT NULL,
    name          TEXT    NOT NULL,
    day_offset    INTEGER NOT NULL,
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

INSERT OR IGNORE INTO schema_version (version) VALUES (${SCHEMA_VERSION});
`;
