export const createDatabaseSQL= `

  CREATE TABLE IF NOT EXISTS mesocycle (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_date TEXT NOT NULL,
    program_name TEXT NOT NULL,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mesocycle_id INTEGER NOT NULL,
    workout_name TEXT NOT NULL,
    workout_order INTEGER NOT NULL UNIQUE,
    notes TEXT,
    FOREIGN KEY (mesocycle_id) REFERENCES mesocycle(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS workout_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_group_id INTEGER NOT NULL,
    tutorial_url TEXT,
    name TEXT NOT NULL,
    notes TEXT,
    FOREIGN KEY (workout_group_id) REFERENCES workout_groups(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS workout_groups_selection (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id INTEGER NOT NULL,
    workout_group_id INTEGER NOT NULL,
    FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE,
    FOREIGN KEY (workout_group_id) REFERENCES workout_groups(id) ON DELETE CASCADE,
    UNIQUE(workout_id, workout_group_id)
  );

  CREATE TABLE IF NOT EXISTS workout_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    exercise_order INTEGER NOT NULL,
    set_number INTEGER NOT NULL,
    reps INTEGER,
    weight REAL,
    rir INTEGER,
    notes TEXT,
    FOREIGN KEY (day_id) REFERENCES days(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS child_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_set_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    exercise_order INTEGER NOT NULL,
    reps INTEGER,
    weight REAL,
    rir INTEGER,
    notes TEXT,
    FOREIGN KEY (parent_set_id) REFERENCES workout_sets(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
  ))
`;

export const deleteDatabaseSQL= `
  DROP TABLE IF EXISTS workout_sets;
  DROP TABLE IF EXISTS day_workout_groups;
  DROP TABLE IF EXISTS exercises;
  DROP TABLE IF EXISTS workout_groups;
  DROP TABLE IF EXISTS days;
  DROP TABLE IF EXISTS program;
`;