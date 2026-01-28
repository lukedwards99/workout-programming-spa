/**
 * CSV Service
 * 
 * Handles all CSV import/export operations for the workout programming app.
 * Uses sectioned CSV format with table markers: [WORKOUT_GROUPS], [EXERCISES], etc.
 * 
 * Architecture:
 * - Uses workout API exclusively (no direct database access)
 * - Exports all tables in dependency order
 * - Imports in same order to maintain referential integrity
 * - Preserves IDs on import (requires clearing data first)
 */

import Papa from 'papaparse';
import {
  workoutGroupsApi,
  exercisesApi,
  daysApi,
  dayWorkoutGroupsApi,
  dayExercisesApi,
  setsApi,
  dataApi
} from '../api/workoutApi.js';

// ===== EXPORT FUNCTIONS =====

/**
 * Export all data as sectioned CSV
 * @returns {Promise<string>} CSV string with all data in sections
 */
export async function exportAllData() {
  try {
    // Fetch all data from APIs
    const [
      workoutGroupsRes,
      exercisesRes,
      daysRes,
      dayExercisesRes,
      setsRes
    ] = await Promise.all([
      workoutGroupsApi.getAll(),
      exercisesApi.getAll(),
      daysApi.getAll(),
      dayExercisesApi.getAll(),
      setsApi.getAll()
    ]);

    // Extract data from responses
    const workoutGroups = workoutGroupsRes.data || [];
    const exercises = exercisesRes.data || [];
    const days = daysRes.data || [];
    const dayExercises = dayExercisesRes.data || [];
    const sets = setsRes.data || [];

    // Fetch day workout groups for all days
    const dayWorkoutGroupsPromises = days.map(day => dayWorkoutGroupsApi.getByDay(day.id));
    const dayWorkoutGroupsResponses = await Promise.all(dayWorkoutGroupsPromises);
    
    // Flatten day workout groups into array with day_id and workout_group_id
    const dayWorkoutGroups = [];
    dayWorkoutGroupsResponses.forEach((response, index) => {
      const dayId = days[index].id;
      const groups = response.data || [];
      groups.forEach(group => {
        dayWorkoutGroups.push({
          id: group.dwg_id,
          day_id: dayId,
          workout_group_id: group.id
        });
      });
    });

    // Build sectioned CSV string
    let csv = '';

    // [WORKOUT_GROUPS] section
    if (workoutGroups.length > 0) {
      csv += '[WORKOUT_GROUPS]\n';
      csv += Papa.unparse(workoutGroups, {
        columns: ['id', 'name', 'notes'],
        header: true
      });
      csv += '\n\n';
    }

    // [EXERCISES] section
    if (exercises.length > 0) {
      csv += '[EXERCISES]\n';
      csv += Papa.unparse(exercises, {
        columns: ['id', 'workout_group_id', 'name', 'notes'],
        header: true
      });
      csv += '\n\n';
    }

    // [DAYS] section
    if (days.length > 0) {
      csv += '[DAYS]\n';
      csv += Papa.unparse(days, {
        columns: ['id', 'day_name', 'day_order'],
        header: true
      });
      csv += '\n\n';
    }

    // [DAY_WORKOUT_GROUPS] section
    if (dayWorkoutGroups.length > 0) {
      csv += '[DAY_WORKOUT_GROUPS]\n';
      csv += Papa.unparse(dayWorkoutGroups, {
        columns: ['id', 'day_id', 'workout_group_id'],
        header: true
      });
      csv += '\n\n';
    }

    // [DAY_EXERCISES] section
    if (dayExercises.length > 0) {
      csv += '[DAY_EXERCISES]\n';
      csv += Papa.unparse(dayExercises, {
        columns: ['id', 'day_id', 'exercise_id', 'exercise_order'],
        header: true
      });
      csv += '\n\n';
    }

    // [SETS] section
    if (sets.length > 0) {
      csv += '[SETS]\n';
      csv += Papa.unparse(sets, {
        columns: ['id', 'day_exercise_id', 'set_order', 'reps', 'weight', 'rir', 'notes'],
        header: true
      });
      csv += '\n\n';
    }

    return csv;
  } catch (error) {
    console.error('Export failed:', error);
    throw new Error(`Failed to export data: ${error.message}`);
  }
}

/**
 * Trigger browser download of CSV file
 * @param {string} filename - Name for downloaded file
 * @param {string} csvContent - CSV content to download
 */
export function downloadCSV(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export and download all data as CSV file
 * @returns {Promise<{success: boolean, filename?: string, error?: string}>}
 */
export async function downloadAllData() {
  try {
    const csv = await exportAllData();
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `workout-complete-${timestamp}.csv`;
    
    downloadCSV(filename, csv);
    
    return { success: true, filename };
  } catch (error) {
    console.error('Failed to download data', error);
    return { success: false, error: error.message };
  }
}

// ===== IMPORT FUNCTIONS =====

/**
 * Import sectioned CSV data
 * @param {string} csvString - The CSV content with section markers
 * @returns {Promise<{success: boolean, counts: object}>}
 */
export async function importAllData(csvString) {
  try {
    // Validate input
    if (!csvString || typeof csvString !== 'string') {
      throw new Error('Invalid CSV data');
    }

    // Parse sectioned CSV into table objects
    const sections = parseSectionedCSV(csvString);

    // Validate that we have at least some data
    if (Object.keys(sections).length === 0) {
      throw new Error('CSV file contains no valid data sections');
    }

    // Clear existing data first (required for ID preservation)
    console.log('Clearing existing data...');
    const clearResponse = await dataApi.clearAllData();
    if (!clearResponse.success) {
      throw new Error('Failed to clear existing data: ' + clearResponse.error);
    }

    const counts = {
      workoutGroups: 0,
      exercises: 0,
      days: 0,
      dayWorkoutGroups: 0,
      dayExercises: 0,
      sets: 0
    };

    // 1. Import Workout Groups (no dependencies)
    if (sections.workout_groups && sections.workout_groups.length > 0) {
      console.log(`Importing ${sections.workout_groups.length} workout groups...`);
      for (const row of sections.workout_groups) {
        const response = await workoutGroupsApi.create({
          id: parseInt(row.id),
          name: row.name,
          notes: row.notes || ''
        });
        if (!response.success) {
          throw new Error(`Failed to import workout group "${row.name}": ${response.error}`);
        }
        counts.workoutGroups++;
      }
    }

    // 2. Import Exercises (depend on workout_groups)
    if (sections.exercises && sections.exercises.length > 0) {
      console.log(`Importing ${sections.exercises.length} exercises...`);
      for (const row of sections.exercises) {
        const response = await exercisesApi.create({
          id: parseInt(row.id),
          workoutGroupId: parseInt(row.workout_group_id),
          name: row.name,
          notes: row.notes || ''
        });
        if (!response.success) {
          throw new Error(`Failed to import exercise "${row.name}": ${response.error}`);
        }
        counts.exercises++;
      }
    }

    // 3. Import Days (no dependencies)
    if (sections.days && sections.days.length > 0) {
      console.log(`Importing ${sections.days.length} days...`);
      for (const row of sections.days) {
        const response = await daysApi.add(row.day_name, parseInt(row.id));
        if (!response.success) {
          throw new Error(`Failed to import day "${row.day_name}": ${response.error}`);
        }
        counts.days++;
      }
    }

    // 4. Import Day Workout Groups (depend on days and workout_groups)
    if (sections.day_workout_groups && sections.day_workout_groups.length > 0) {
      console.log(`Importing ${sections.day_workout_groups.length} day-workout group associations...`);
      
      // Group by day_id to batch set operations
      const groupedByDay = {};
      sections.day_workout_groups.forEach(row => {
        const dayId = parseInt(row.day_id);
        if (!groupedByDay[dayId]) {
          groupedByDay[dayId] = [];
        }
        groupedByDay[dayId].push({
          id: parseInt(row.id),
          workoutGroupId: parseInt(row.workout_group_id)
        });
      });

      // Set workout groups for each day
      for (const [dayId, groups] of Object.entries(groupedByDay)) {
        const workoutGroupIds = groups.map(g => g.workoutGroupId);
        const response = await dayWorkoutGroupsApi.setForDay(parseInt(dayId), workoutGroupIds);
        if (!response.success) {
          throw new Error(`Failed to set workout groups for day ${dayId}: ${response.error}`);
        }
        counts.dayWorkoutGroups += groups.length;
      }
    }

    // 5. Import Day Exercises (depend on days and exercises)
    if (sections.day_exercises && sections.day_exercises.length > 0) {
      console.log(`Importing ${sections.day_exercises.length} day exercises...`);
      for (const row of sections.day_exercises) {
        const response = await dayExercisesApi.create({
          id: parseInt(row.id),
          dayId: parseInt(row.day_id),
          exerciseId: parseInt(row.exercise_id),
          exerciseOrder: parseInt(row.exercise_order)
        });
        if (!response.success) {
          throw new Error(`Failed to import day exercise: ${response.error}`);
        }
        counts.dayExercises++;
      }
    }

    // 6. Import Sets (depend on day_exercises)
    if (sections.sets && sections.sets.length > 0) {
      console.log(`Importing ${sections.sets.length} sets...`);
      for (const row of sections.sets) {
        const response = await setsApi.create({
          id: parseInt(row.id),
          dayExerciseId: parseInt(row.day_exercise_id),
          setOrder: parseInt(row.set_order),
          reps: row.reps ? parseInt(row.reps) : null,
          weight: row.weight ? parseFloat(row.weight) : null,
          rir: row.rir ? parseInt(row.rir) : null,
          notes: row.notes || ''
        });
        if (!response.success) {
          throw new Error(`Failed to import set: ${response.error}`);
        }
        counts.sets++;
      }
    }

    console.log('Import complete:', counts);
    return { success: true, counts };
  } catch (error) {
    console.error('Import failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Parse sectioned CSV into table objects
 * @param {string} csvString - CSV with section markers
 * @returns {object} Object with table name keys and row arrays
 */
function parseSectionedCSV(csvString) {
  const sections = {};
  const lines = csvString.split('\n');

  let currentSection = null;
  let currentData = [];

  for (const line of lines) {
    // Check for section header: [TABLE_NAME]
    const sectionMatch = line.match(/^\[([A-Z_]+)\]$/);
    
    if (sectionMatch) {
      // Save previous section if exists
      if (currentSection && currentData.length > 0) {
        const csvData = currentData.join('\n');
        sections[currentSection.toLowerCase()] = parseCSVSection(csvData);
      }
      
      // Start new section
      currentSection = sectionMatch[1];
      currentData = [];
    } else if (currentSection && line.trim()) {
      // Add line to current section data
      currentData.push(line);
    }
  }

  // Save last section
  if (currentSection && currentData.length > 0) {
    const csvData = currentData.join('\n');
    sections[currentSection.toLowerCase()] = parseCSVSection(csvData);
  }

  return sections;
}

/**
 * Parse a single CSV section
 * @param {string} csvString - CSV data without section header
 * @returns {Array} Parsed rows
 */
function parseCSVSection(csvString) {
  const result = Papa.parse(csvString, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    transform: (value) => value.trim()
  });

  if (result.errors && result.errors.length > 0) {
    console.warn('CSV parsing warnings:', result.errors);
  }

  return result.data;
}

// ===== UTILITY FUNCTIONS =====

/**
 * Detect CSV format version
 * @param {string} csvString - CSV content
 * @returns {string} Format version: 'phase2' (sectioned) or 'unknown'
 */
export function detectCSVFormat(csvString) {
  if (csvString.includes('[WORKOUT_GROUPS]') || 
      csvString.includes('[EXERCISES]') || 
      csvString.includes('[DAYS]')) {
    return 'phase2';
  }
  return 'unknown';
}
