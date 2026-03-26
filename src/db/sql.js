export const createDatabaseSQL= `

  CREATE TABLE IF NOT EXISTS mesocycles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_date TEXT NOT NULL,
    program_name TEXT NOT NULL,
    microcycle_length INTEGER NOT NULL,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mesocycle_id INTEGER NOT NULL,
    workout_name TEXT NOT NULL,
    workout_order INTEGER NOT NULL UNIQUE,
    notes TEXT,
    FOREIGN KEY (mesocycle_id) REFERENCES mesocycles(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS exercise_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tutorial_url TEXT,
    name TEXT NOT NULL,
    notes TEXT,
  );

  CREATE TABLE IF NOT EXISTS exercise_variations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    primary BOOLEAN NOT NULL DEFAULT 0,
    exercise_id INTEGER NOT NULL,
    variation_name TEXT NOT NULL,
    tutorial_url TEXT,
    notes TEXT,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS exercise_group_exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_group_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,

    FOREIGN KEY (exercise_group_id) REFERENCES exercise_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE,
    UNIQUE(exercise_group_id, exercise_id)
  );

  CREATE TABLE IF NOT EXISTS workout_exercise_groups_selection (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id INTEGER NOT NULL,
    exercise_group_id INTEGER NOT NULL,
    FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_group_id) REFERENCES exercise_groups(id) ON DELETE CASCADE,
    UNIQUE(workout_id, exercise_group_id)
  );

  CREATE TABLE IF NOT EXISTS workout_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    exercise_variation_id INTEGER,
    exercise_order INTEGER NOT NULL,
    set_number INTEGER NOT NULL,
    reps INTEGER,
    weight REAL,
    rir INTEGER,
    notes TEXT,
    FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_variation_id) REFERENCES exercise_variations(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS child_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_set_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    exercise_variation_id INTEGER,
    exercise_order INTEGER NOT NULL,
    reps INTEGER,
    weight REAL,
    rir INTEGER,
    notes TEXT,
    FOREIGN KEY (parent_set_id) REFERENCES workout_sets(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_variation_id) REFERENCES exercise_variations(id) ON DELETE SET NULL
  );
`;

export const deleteDatabaseSQL= `
  DROP TABLE IF EXISTS child_sets;
  DROP TABLE IF EXISTS workout_sets;
  DROP TABLE IF EXISTS workout_exercise_groups_selection;
  DROP TABLE IF EXISTS exercises;
  DROP TABLE IF EXISTS exercise_variations;
  DROP TABLE IF EXISTS exercise_group_exercises;
  DROP TABLE IF EXISTS exercise_groups;
  DROP TABLE IF EXISTS workouts;
  DROP TABLE IF EXISTS mesocycles;
`;