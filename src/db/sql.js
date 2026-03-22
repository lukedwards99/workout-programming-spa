export const createDatabaseSQL= `

  CREATE TABLE IF NOT EXISTS program (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_name TEXT NOT NULL,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_id INTEGER NOT NULL,
    day_name TEXT NOT NULL,
    day_order INTEGER NOT NULL UNIQUE,
    notes TEXT
    FOREIGN KEY (program_id) REFERENCES program(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS workout_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_group_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    notes TEXT,
    FOREIGN KEY (workout_group_id) REFERENCES workout_groups(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS day_workout_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_id INTEGER NOT NULL,
    workout_group_id INTEGER NOT NULL,
    FOREIGN KEY (day_id) REFERENCES days(id) ON DELETE CASCADE,
    FOREIGN KEY (workout_group_id) REFERENCES workout_groups(id) ON DELETE CASCADE,
    UNIQUE(day_id, workout_group_id)
  );

  CREATE TABLE IF NOT EXISTS workout_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    exercise_order INTEGER NOT NULL,
    set_order INTEGER NOT NULL,
    reps INTEGER,
    weight REAL,
    rir INTEGER,
    notes TEXT,
    FOREIGN KEY (day_id) REFERENCES days(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
  );
`;

export const deleteDatabaseSQL= `
  DROP TABLE IF EXISTS workout_sets;
  DROP TABLE IF EXISTS day_workout_groups;
  DROP TABLE IF EXISTS exercises;
  DROP TABLE IF EXISTS workout_groups;
  DROP TABLE IF EXISTS days;
  DROP TABLE IF EXISTS program;
`;