/**
 * Database DDL (Data Definition Language)
 * Contains all table creation statements
 */

export const schema = `
  CREATE TABLE IF NOT EXISTS days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_name TEXT NOT NULL,
    day_order INTEGER NOT NULL UNIQUE
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

  CREATE TABLE IF NOT EXISTS sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    set_order INTEGER NOT NULL,
    reps INTEGER,
    rir INTEGER,
    notes TEXT,
    FOREIGN KEY (day_id) REFERENCES days(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
  );
`;
