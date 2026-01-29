/**
 * Database DDL (Data Definition Language)
 * Contains all table creation statements
 * 
 * Schema Design (Hybrid Approach):
 * - days: Separate table for day management
 * - workout_groups: Master list of workout categories
 * - exercises: Master list of exercises
 * - day_workout_groups: Selected workout groups per day (UI filter)
 * - workout_sets: Denormalized table combining exercises and sets per day
 */

export const schema = `
  CREATE TABLE IF NOT EXISTS days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_name TEXT NOT NULL,
    day_order INTEGER NOT NULL UNIQUE,
    notes TEXT
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
    set_type INTEGER NOT NULL,
    set_order INTEGER NOT NULL,
    reps INTEGER,
    weight REAL,
    rir INTEGER,
    notes TEXT,
    FOREIGN KEY (day_id) REFERENCES days(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
  );
`;
