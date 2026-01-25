import React, { createContext, useContext, useEffect, useState } from 'react';
import initSqlJs from 'sql.js';
import Papa from 'papaparse';

const DbContext = createContext(null);

export function useDb() {
  return useContext(DbContext);
}

export function DbProvider({ children }) {
  const [db, setDb] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize DB
  useEffect(() => {
    const loadDb = async () => {
      try {
        // Locate the wasm file. We have copied sql-wasm.wasm to the public folder during setup.
        const SQL = await initSqlJs({
          locateFile: file => `/${file}` 
        });
        
        const database = new SQL.Database();
        setDb(database);
        
        // Load DDL
        initSchema(database);
        
      } catch (err) {
        console.error("Failed to load database", err);
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadDb();
  }, []);

  const initSchema = (database) => {
    // DDL Definition
    const ddl = `
      -- Core Table: Workouts (One per day of the week)
      CREATE TABLE IF NOT EXISTS workouts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          day_name TEXT NOT NULL UNIQUE, 
          workout_name TEXT, 
          is_rest_day BOOLEAN DEFAULT 0
      );
      
      -- Grouping Entity: Workout Groups
      CREATE TABLE IF NOT EXISTS workout_groups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL, 
          description TEXT
      );
      
      -- Core Entity: Exercises
      CREATE TABLE IF NOT EXISTS exercises (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          notes TEXT
      );
      
      -- Relationship: Exercises to Groups
      CREATE TABLE IF NOT EXISTS group_exercises (
          group_id INTEGER,
          exercise_id INTEGER,
          PRIMARY KEY (group_id, exercise_id),
          FOREIGN KEY(group_id) REFERENCES workout_groups(id),
          FOREIGN KEY(exercise_id) REFERENCES exercises(id)
      );
      
      -- Transactional Data: Sets
      CREATE TABLE IF NOT EXISTS sets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workout_id INTEGER NOT NULL,
          group_id INTEGER NOT NULL,
          exercise_id INTEGER NOT NULL,
          set_order INTEGER NOT NULL,
          reps INTEGER,
          rir INTEGER, 
          notes TEXT,
          FOREIGN KEY(workout_id) REFERENCES workouts(id),
          FOREIGN KEY(group_id) REFERENCES workout_groups(id),
          FOREIGN KEY(exercise_id) REFERENCES exercises(id)
      );
    `;
    database.run(ddl);

    // Seed Data Check
    const stmt = database.prepare("SELECT count(*) as count FROM workouts");
    stmt.step();
    const count = stmt.getAsObject().count;
    stmt.free();

    if (count === 0) {
      database.run(`
        INSERT INTO workouts (day_name) VALUES 
        ('Monday'), ('Tuesday'), ('Wednesday'), ('Thursday'), 
        ('Friday'), ('Saturday'), ('Sunday');
      `);
    }
  };

  /**
   * EXPORT DATABASE TO CSV
   * Flattens the 3NF DB into a single table.
   */
  const exportToCsv = () => {
    if (!db) return;
    
    // We join everything to make a flat view
    // Columns: Day, WorkoutName, IsRest, GroupName, ExerciseName, ExerciseNotes, SetOrder, Reps, RIR, SetNotes
    const query = `
      SELECT 
        w.day_name, w.workout_name, w.is_rest_day,
        wg.name as group_name,
        e.name as exercise_name, e.notes as exercise_notes,
        s.set_order, s.reps, s.rir, s.notes as set_notes
      FROM workouts w
      LEFT JOIN sets s ON w.id = s.workout_id
      LEFT JOIN workout_groups wg ON s.group_id = wg.id
      LEFT JOIN exercises e ON s.exercise_id = e.id
      ORDER BY 
        CASE 
          WHEN w.day_name = 'Monday' THEN 1
          WHEN w.day_name = 'Tuesday' THEN 2
          WHEN w.day_name = 'Wednesday' THEN 3
          WHEN w.day_name = 'Thursday' THEN 4
          WHEN w.day_name = 'Friday' THEN 5
          WHEN w.day_name = 'Saturday' THEN 6
          WHEN w.day_name = 'Sunday' THEN 7
        END,
        s.set_order;
    `;
    
    const stmt = db.prepare(query);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();

    const csv = Papa.unparse(rows);
    
    // Create download trigger
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'workout_program.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * IMPORT CSV TO DATABASE
   * Repopulates the DB from the flat CSV.
   * This is a "destructive" reload or a "smart" merge? The prompt implies "re-upload to edit", 
   * so we probably wipe current state and load new state implies a full reset for simplicity.
   */
  const importFromCsv = (file) => {
    if (!db) return;

    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const rows = results.data;
        if (!rows || rows.length === 0) return;

        // Transaction for safety
        db.run("BEGIN TRANSACTION");
        try {
          // Clear existing structural data? Or just update?
          // To ensure mapping, let's clear sets and re-hydrate.
          // We keep the workouts structure (Mon-Sun), but update properties.
          
          db.run("DELETE FROM sets;");
          db.run("DELETE FROM group_exercises;"); 
          // We might want to keep libraries (Exercises/Groups) or just ensure they exist.
          // Let's ensure they exist as we iterate.

          rows.forEach(row => {
            const { 
              day_name, workout_name, is_rest_day,
              group_name, exercise_name, exercise_notes,
              set_order, reps, rir, set_notes
            } = row;

            if (!day_name) return; // Skip empty rows

            // 1. Update Workout Day Metadata
            db.run(`
              UPDATE workouts 
              SET workout_name = $wName, is_rest_day = $rest 
              WHERE day_name = $dName
            `, {
              $wName: workout_name,
              $rest: is_rest_day === 'true' || is_rest_day === '1' ? 1 : 0,
              $dName: day_name
            });

            // If this row has no exercise data (it might be just a 'rest' marker), continue
            if (!exercise_name) return;

            // 2. Resolve Group
            let groupId;
            // distinct name check
            const groupStmt = db.prepare("SELECT id FROM workout_groups WHERE name = $name");
            const groupRes = groupStmt.get({ $name: group_name });
            if (groupRes && groupRes.length > 0) {
               groupId = groupRes[0];
            } else {
               db.run("INSERT INTO workout_groups (name) VALUES (?)", [group_name]);
               groupId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
            }
            groupStmt.free();

            // 3. Resolve Exercise
            let exerciseId;
            const exStmt = db.prepare("SELECT id FROM exercises WHERE name = $name");
            const exRes = exStmt.get({ $name: exercise_name });
            if (exRes && exRes.length > 0) {
               exerciseId = exRes[0];
               // Update notes just in case
               db.run("UPDATE exercises SET notes = ? WHERE id = ?", [exercise_notes, exerciseId]);
            } else {
               db.run("INSERT INTO exercises (name, notes) VALUES (?, ?)", [exercise_name, exercise_notes]);
               exerciseId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
            }
            exStmt.free();

            // 4. Link Group <-> Exercise (Many to Many)
            // INSERT OR IGNORE
            db.run(`INSERT OR IGNORE INTO group_exercises (group_id, exercise_id) VALUES (?, ?)`, [groupId, exerciseId]);

            // 5. Insert Set
            // We need workout_id
            const wStmt = db.prepare("SELECT id FROM workouts WHERE day_name = ?");
            const wId = wStmt.get([day_name])[0];
            wStmt.free();

            db.run(`
              INSERT INTO sets (workout_id, group_id, exercise_id, set_order, reps, rir, notes)
              VALUES ($wid, $gid, $eid, $ord, $reps, $rir, $notes)
            `, {
              $wid: wId, 
              $gid: groupId, 
              $eid: exerciseId,
              $ord: set_order,
              $reps: reps,
              $rir: rir,
              $notes: set_notes
            });
          });

          db.run("COMMIT");
          console.log("Import Successful");
        } catch (err) {
          console.error("Import failed", err);
          db.run("ROLLBACK");
        }
      }
    });
  };

  /**
   * CRUD OPERATIONS
   */
  const getWorkouts = () => {
    if(!db) return [];
    const res = db.exec("SELECT * FROM workouts");
    if(res.length === 0) return [];
    const columns = res[0].columns;
    const values = res[0].values;
    return values.map(row => {
      let obj = {};
      columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    });
  };

  const getWorkoutSummary = (workoutId) => {
    // Return groups trained on this day
    if(!db) return [];
    const stmt = db.prepare(`
        SELECT DISTINCT wg.name 
        FROM sets s
        JOIN workout_groups wg ON s.group_id = wg.id
        WHERE s.workout_id = $id
    `);
    const results = [];
    stmt.bind({$id: workoutId});
    while(stmt.step()) {
        results.push(stmt.get()[0]);
    }
    stmt.free();
    return results;
  };

  return (
    <DbContext.Provider value={{ db, isLoading, error, exportToCsv, importFromCsv, getWorkouts, getWorkoutSummary }}>
      {children}
    </DbContext.Provider>
  );
}
