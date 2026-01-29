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
 * 
 * New simplified schema:
 * - workout_sets replaces day_exercises + sets tables
 */

import Papa from 'papaparse';
import {
  workoutGroupsApi,
  exercisesApi,
  daysApi,
  dayWorkoutGroupsApi,
  workoutSetsApi,
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
      workoutSetsRes
    ] = await Promise.all([
      workoutGroupsApi.getAll(),
      exercisesApi.getAll(),
      daysApi.getAll(),
      workoutSetsApi.getAll()
    ]);

    // Extract data from responses
    const workoutGroups = workoutGroupsRes.data || [];
    const exercises = exercisesRes.data || [];
    const days = daysRes.data || [];
    const workoutSets = workoutSetsRes.data || [];

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
          id: group.id,
          day_id: dayId,
          workout_group_id: group.workout_group_id
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

    // [WORKOUT_SETS] section (replaces DAY_EXERCISES + SETS)
    if (workoutSets.length > 0) {
      csv += '[WORKOUT_SETS]\n';
      csv += Papa.unparse(workoutSets, {
        columns: ['id', 'day_id', 'exercise_id', 'exercise_order', 'set_order', 'reps', 'weight', 'rir', 'notes'],
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

/**
 * Export workout program as pretty-printed, human-readable CSV
 * Format: Day, Exercise, Workout Group, Set #, Reps, Weight, RIR, Notes
 * @returns {Promise<string>} Human-readable CSV string
 */
export async function exportPrettyPrintProgram() {
  try {
    // Fetch all days
    const daysRes = await daysApi.getAll();
    const days = daysRes.data || [];
    
    if (days.length === 0) {
      throw new Error('No workout days found');
    }
    
    // Build flat array of rows
    const rows = [];
    
    for (const day of days) {
      // Get exercises and sets for this day, grouped by exercise
      const groupedRes = await workoutSetsApi.getByDayGrouped(day.id);
      const exercisesWithSets = groupedRes.data || [];
      
      if (exercisesWithSets.length === 0) {
        // Add empty day row
        rows.push({
          day: day.day_name,
          exercise: '(No exercises)',
          workout_group: '',
          set_number: '',
          reps: '',
          weight: '',
          rir: '',
          notes: ''
        });
      } else {
        // Add rows for each set
        exercisesWithSets.forEach(exercise => {
          exercise.sets.forEach(set => {
            rows.push({
              day: day.day_name,
              exercise: exercise.exercise_name,
              workout_group: exercise.workout_group_name,
              set_number: set.set_order,
              reps: set.reps || '',
              weight: set.weight || '',
              rir: set.rir !== null && set.rir !== undefined ? set.rir : '',
              notes: set.notes || ''
            });
          });
        });
      }
    }
    
    // Convert to CSV
    const csv = Papa.unparse(rows, {
      columns: ['day', 'exercise', 'workout_group', 'set_number', 'reps', 'weight', 'rir', 'notes'],
      header: true
    });
    
    return csv;
  } catch (error) {
    console.error('Pretty print export failed:', error);
    throw new Error(`Failed to export pretty print program: ${error.message}`);
  }
}

/**
 * Export and download workout program as pretty-printed CSV
 * @returns {Promise<{success: boolean, filename?: string, error?: string}>}
 */
export async function downloadPrettyPrintProgram() {
  try {
    const csv = await exportPrettyPrintProgram();
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `workout-program-${timestamp}.csv`;
    
    downloadCSV(filename, csv);
    
    return { success: true, filename };
  } catch (error) {
    console.error('Failed to download pretty print program', error);
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
      workoutSets: 0
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

    // 5. Import Workout Sets (depend on days and exercises)
    if (sections.workout_sets && sections.workout_sets.length > 0) {
      console.log(`Importing ${sections.workout_sets.length} workout sets...`);
      for (const row of sections.workout_sets) {
        const response = await workoutSetsApi.create({
          id: parseInt(row.id),
          dayId: parseInt(row.day_id),
          exerciseId: parseInt(row.exercise_id),
          exerciseOrder: parseInt(row.exercise_order),
          setOrder: parseInt(row.set_order),
          reps: row.reps ? parseInt(row.reps) : null,
          weight: row.weight ? parseFloat(row.weight) : null,
          rir: row.rir ? parseInt(row.rir) : null,
          notes: row.notes || ''
        });
        if (!response.success) {
          throw new Error(`Failed to import workout set: ${response.error}`);
        }
        counts.workoutSets++;
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
 * @returns {string} Format version: 'v2' (current) or 'unknown'
 */
export function detectCSVFormat(csvString) {
  if (csvString.includes('[WORKOUT_SETS]')) {
    return 'v2'; // New simplified format
  }
  if (csvString.includes('[DAY_EXERCISES]') && csvString.includes('[SETS]')) {
    return 'v1'; // Old normalized format (not supported for import)
  }
  if (csvString.includes('[WORKOUT_GROUPS]') || 
      csvString.includes('[EXERCISES]') || 
      csvString.includes('[DAYS]')) {
    return 'v2'; // Could be v2 without workout sets yet
  }
  return 'unknown';
}
