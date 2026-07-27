export const SCHEMA_VERSION: number = 7;

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
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL,
    notes TEXT,
    UNIQUE(name)
);

CREATE TABLE IF NOT EXISTS exercises (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_group_id INTEGER NOT NULL,
    name              TEXT    NOT NULL,
    exercise_type     TEXT    NOT NULL DEFAULT 'strength'
                              CHECK(exercise_type IN ('strength', 'cardio')),
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

CREATE TABLE IF NOT EXISTS workout_exercises (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id            INTEGER NOT NULL,
    exercise_id           INTEGER NOT NULL,
    exercise_variation_id INTEGER,
    exercise_order        INTEGER NOT NULL CHECK(exercise_order >= 0),
    FOREIGN KEY (workout_id)            REFERENCES workouts(id)             ON DELETE CASCADE,
    FOREIGN KEY (exercise_id)           REFERENCES exercises(id)            ON DELETE CASCADE,
    FOREIGN KEY (exercise_variation_id) REFERENCES exercise_variations(id)  ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS strength_sets (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_exercise_id INTEGER NOT NULL,
    set_number          INTEGER NOT NULL CHECK(set_number >= 1),
    set_type            TEXT    NOT NULL DEFAULT 'normal'
                             CHECK(set_type IN ('warmup', 'normal', 'dropset', 'failure', 'rest-pause')),
    planned_reps        INTEGER CHECK(planned_reps >= 0),
    actual_reps         INTEGER CHECK(actual_reps >= 0),
    weight              REAL CHECK(weight >= 0),
    rir                 INTEGER,
    notes               TEXT,
    FOREIGN KEY (workout_exercise_id) REFERENCES workout_exercises(id) ON DELETE CASCADE,
    UNIQUE(workout_exercise_id, set_number)
);

CREATE TABLE IF NOT EXISTS cardio_sets (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_exercise_id      INTEGER NOT NULL,
    set_number               INTEGER NOT NULL CHECK(set_number >= 1),
    planned_duration_seconds INTEGER CHECK(planned_duration_seconds >= 0),
    actual_duration_seconds  INTEGER CHECK(actual_duration_seconds >= 0),
    planned_distance         REAL CHECK(planned_distance >= 0),
    actual_distance          REAL CHECK(actual_distance >= 0),
    distance_unit            TEXT CHECK(distance_unit IN ('mi', 'km', 'm')),
    target_rpe               INTEGER CHECK(target_rpe BETWEEN 1 AND 10),
    actual_rpe               INTEGER CHECK(actual_rpe BETWEEN 1 AND 10),
    notes                    TEXT,
    FOREIGN KEY (workout_exercise_id) REFERENCES workout_exercises(id) ON DELETE CASCADE,
    CHECK(
      (planned_distance IS NULL AND actual_distance IS NULL)
      OR distance_unit IS NOT NULL
    ),
    UNIQUE(workout_exercise_id, set_number)
);

CREATE INDEX IF NOT EXISTS idx_mesocycles_sort_start
  ON mesocycles(sort_order, start_date);
CREATE INDEX IF NOT EXISTS idx_workouts_mesocycle_id
  ON workouts(mesocycle_id);
CREATE INDEX IF NOT EXISTS idx_workouts_mesocycle_sort
  ON workouts(mesocycle_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_exercises_group_id
  ON exercises(exercise_group_id);
CREATE INDEX IF NOT EXISTS idx_exercises_type
  ON exercises(exercise_type);
CREATE INDEX IF NOT EXISTS idx_exercise_variations_exercise_id
  ON exercise_variations(exercise_id);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout_id
  ON workout_exercises(workout_id);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_exercise_id
  ON workout_exercises(exercise_id);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_variation_id
  ON workout_exercises(exercise_variation_id);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout_order
  ON workout_exercises(workout_id, exercise_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_exercises_unique_block
  ON workout_exercises(workout_id, exercise_id, COALESCE(exercise_variation_id, 0));
CREATE INDEX IF NOT EXISTS idx_strength_sets_block_id
  ON strength_sets(workout_exercise_id);
CREATE INDEX IF NOT EXISTS idx_strength_sets_set_type
  ON strength_sets(set_type);
CREATE INDEX IF NOT EXISTS idx_cardio_sets_block_id
  ON cardio_sets(workout_exercise_id);

CREATE TRIGGER IF NOT EXISTS validate_workout_exercise_variation_insert
BEFORE INSERT ON workout_exercises
WHEN NEW.exercise_variation_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM exercise_variations
    WHERE id = NEW.exercise_variation_id AND exercise_id = NEW.exercise_id
  )
BEGIN
  SELECT RAISE(ABORT, 'Exercise variation does not belong to exercise');
END;

CREATE TRIGGER IF NOT EXISTS validate_workout_exercise_variation_update
BEFORE UPDATE OF exercise_id, exercise_variation_id ON workout_exercises
WHEN NEW.exercise_variation_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM exercise_variations
    WHERE id = NEW.exercise_variation_id AND exercise_id = NEW.exercise_id
  )
BEGIN
  SELECT RAISE(ABORT, 'Exercise variation does not belong to exercise');
END;

CREATE TRIGGER IF NOT EXISTS prevent_used_exercise_type_change
BEFORE UPDATE OF exercise_type ON exercises
WHEN OLD.exercise_type <> NEW.exercise_type
  AND EXISTS (SELECT 1 FROM workout_exercises WHERE exercise_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'Cannot change the type of a programmed exercise');
END;

CREATE TRIGGER IF NOT EXISTS validate_strength_set_type_insert
BEFORE INSERT ON strength_sets
WHEN (
  SELECT e.exercise_type
  FROM workout_exercises we
  JOIN exercises e ON e.id = we.exercise_id
  WHERE we.id = NEW.workout_exercise_id
) <> 'strength'
BEGIN
  SELECT RAISE(ABORT, 'Strength set requires a strength exercise');
END;

CREATE TRIGGER IF NOT EXISTS validate_strength_set_type_update
BEFORE UPDATE OF workout_exercise_id ON strength_sets
WHEN (
  SELECT e.exercise_type
  FROM workout_exercises we
  JOIN exercises e ON e.id = we.exercise_id
  WHERE we.id = NEW.workout_exercise_id
) <> 'strength'
BEGIN
  SELECT RAISE(ABORT, 'Strength set requires a strength exercise');
END;

CREATE TRIGGER IF NOT EXISTS validate_cardio_set_type_insert
BEFORE INSERT ON cardio_sets
WHEN (
  SELECT e.exercise_type
  FROM workout_exercises we
  JOIN exercises e ON e.id = we.exercise_id
  WHERE we.id = NEW.workout_exercise_id
) <> 'cardio'
BEGIN
  SELECT RAISE(ABORT, 'Cardio set requires a cardio exercise');
END;

CREATE TRIGGER IF NOT EXISTS validate_cardio_set_type_update
BEFORE UPDATE OF workout_exercise_id ON cardio_sets
WHEN (
  SELECT e.exercise_type
  FROM workout_exercises we
  JOIN exercises e ON e.id = we.exercise_id
  WHERE we.id = NEW.workout_exercise_id
) <> 'cardio'
BEGIN
  SELECT RAISE(ABORT, 'Cardio set requires a cardio exercise');
END;

INSERT OR IGNORE INTO schema_version (version) VALUES (${SCHEMA_VERSION});
`;
