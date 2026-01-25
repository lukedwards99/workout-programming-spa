-- ========================================
-- Workout Programming App - Database Schema
-- ========================================
-- This schema is normalized to 3NF for SQLite storage
-- CSV export will use a denormalized single-table format

-- Days Table
-- Static 7 records representing days of the week
CREATE TABLE IF NOT EXISTS days (
    id INTEGER PRIMARY KEY,
    day_name TEXT NOT NULL UNIQUE,
    day_order INTEGER NOT NULL UNIQUE
);

-- Insert the 7 days (done in seedData.js)
-- INSERT INTO days (id, day_name, day_order) VALUES 
--   (1, 'Monday', 1), (2, 'Tuesday', 2), (3, 'Wednesday', 3),
--   (4, 'Thursday', 4), (5, 'Friday', 5), (6, 'Saturday', 6), (7, 'Sunday', 7);

-- Workout Groups Table
-- Represents muscle groups, rest days, cardio, etc.
CREATE TABLE IF NOT EXISTS workout_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    notes TEXT
);

-- Exercises Table
-- Each exercise belongs to one workout group (many-to-one)
-- Exercises are generic and not tied to specific days
CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_group_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    notes TEXT,
    FOREIGN KEY (workout_group_id) REFERENCES workout_groups(id) ON DELETE CASCADE
);

-- Day Workout Groups Junction Table
-- Defines which workout groups are assigned to which days
-- A day can have multiple workout groups
CREATE TABLE IF NOT EXISTS day_workout_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_id INTEGER NOT NULL,
    workout_group_id INTEGER NOT NULL,
    FOREIGN KEY (day_id) REFERENCES days(id) ON DELETE CASCADE,
    FOREIGN KEY (workout_group_id) REFERENCES workout_groups(id) ON DELETE CASCADE,
    UNIQUE(day_id, workout_group_id)
);

-- Sets Table
-- Stores the actual workout data for exercises on specific days
-- Each set is tied to a day and an exercise
-- One exercise can have multiple sets on the same day
CREATE TABLE IF NOT EXISTS sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    set_order INTEGER NOT NULL,
    reps INTEGER,
    rir INTEGER,  -- Reps In Reserve
    notes TEXT,
    FOREIGN KEY (day_id) REFERENCES days(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
);

-- ========================================
-- CSV Export Format (Denormalized)
-- ========================================
-- When exporting to CSV, data will be flattened to a single table:
-- 
-- Columns:
--   - day_name (TEXT)
--   - day_order (INTEGER)
--   - workout_group_name (TEXT)
--   - exercise_name (TEXT)
--   - exercise_notes (TEXT)
--   - set_order (INTEGER)
--   - reps (INTEGER)
--   - rir (INTEGER)
--   - set_notes (TEXT)
--
-- Example CSV row:
-- Monday,1,Chest,Bench Press,Barbell movement,1,8,2,Warm up first
--
-- On import, the CSV will be parsed and data will be normalized
-- back into the relational structure above.
