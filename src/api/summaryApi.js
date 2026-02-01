/**
 * Summary API
 * 
 * Provides aggregated workout summary data across all days.
 * Calculates statistics for exercises, sets, and RIR.
 */

import {
  getAllDays,
  getWorkoutSetsByDay
} from '../db/dataService.js';

import { successResponse, errorResponse } from './utils/response.js';
import { handleApiCall } from './utils/errorHandler.js';

export const summaryApi = {
  /**
   * Get comprehensive summary data for all days
   * Returns days with their statistics and exercise breakdowns
   */
  getSummaryData: async () => {
    return handleApiCall(
      async () => {
        const days = getAllDays();
        
        // Build summary for each day
        const daysWithSummary = days.map(day => {
          const sets = getWorkoutSetsByDay(day.id);
          
          // Group sets by exercise
          const exerciseMap = new Map();
          
          sets.forEach(set => {
            if (!exerciseMap.has(set.exercise_id)) {
              exerciseMap.set(set.exercise_id, {
                exerciseId: set.exercise_id,
                exerciseName: set.exercise_name,
                workoutGroupName: set.workout_group_name,
                sets: []
              });
            }
            exerciseMap.get(set.exercise_id).sets.push(set);
          });
          
          // Calculate statistics for each exercise
          const exerciseBreakdown = Array.from(exerciseMap.values()).map(exercise => {
            const setsWithRir = exercise.sets.filter(s => s.rir !== null && s.rir !== undefined);
            const avgRir = setsWithRir.length > 0
              ? setsWithRir.reduce((sum, s) => sum + s.rir, 0) / setsWithRir.length
              : null;
            
            return {
              exerciseId: exercise.exerciseId,
              exerciseName: exercise.exerciseName,
              workoutGroupName: exercise.workoutGroupName,
              setCount: exercise.sets.length,
              avgRir: avgRir !== null ? Number(avgRir.toFixed(1)) : null
            };
          });
          
          // Calculate day-level statistics
          const totalSets = sets.length;
          const totalExercises = exerciseMap.size;
          const setsWithRir = sets.filter(s => s.rir !== null && s.rir !== undefined);
          const dayAvgRir = setsWithRir.length > 0
            ? Number((setsWithRir.reduce((sum, s) => sum + s.rir, 0) / setsWithRir.length).toFixed(1))
            : null;
          
          return {
            id: day.id,
            name: day.day_name,
            order: day.day_order,
            totalExercises,
            totalSets,
            avgRir: dayAvgRir,
            exerciseBreakdown: exerciseBreakdown.sort((a, b) => 
              a.exerciseName.localeCompare(b.exerciseName)
            )
          };
        });
        
        return daysWithSummary;
      },
      'Failed to fetch summary data'
    );
  },

  /**
   * Calculate aggregate statistics for selected days
   * Aggregates exercise data across multiple days
   */
  calculateAggregateStats: (daysData, selectedDayIds) => {
    try {
      const selectedDays = daysData.filter(day => selectedDayIds.includes(day.id));
      
      if (selectedDays.length === 0) {
        return {
          totalDays: 0,
          totalExercises: 0,
          totalSets: 0,
          avgRir: null,
          exerciseAggregates: []
        };
      }
      
      // Aggregate totals
      const totalDays = selectedDays.length;
      const totalSets = selectedDays.reduce((sum, day) => sum + day.totalSets, 0);
      
      // Aggregate by exercise across all selected days
      const exerciseMap = new Map();
      
      selectedDays.forEach(day => {
        day.exerciseBreakdown.forEach(exercise => {
          if (!exerciseMap.has(exercise.exerciseId)) {
            exerciseMap.set(exercise.exerciseId, {
              exerciseId: exercise.exerciseId,
              exerciseName: exercise.exerciseName,
              workoutGroupName: exercise.workoutGroupName,
              totalSets: 0,
              rirValues: []
            });
          }
          
          const aggregate = exerciseMap.get(exercise.exerciseId);
          aggregate.totalSets += exercise.setCount;
          
          // Collect RIR values (we'll calculate weighted average)
          if (exercise.avgRir !== null) {
            // Add the average RIR weighted by set count
            for (let i = 0; i < exercise.setCount; i++) {
              aggregate.rirValues.push(exercise.avgRir);
            }
          }
        });
      });
      
      // Calculate exercise-level statistics
      const exerciseAggregates = Array.from(exerciseMap.values()).map(exercise => {
        const avgRir = exercise.rirValues.length > 0
          ? Number((exercise.rirValues.reduce((sum, rir) => sum + rir, 0) / exercise.rirValues.length).toFixed(1))
          : null;
        
        return {
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.exerciseName,
          workoutGroupName: exercise.workoutGroupName,
          totalSets: exercise.totalSets,
          avgRir
        };
      }).sort((a, b) => b.totalSets - a.totalSets); // Sort by total sets descending
      
      // Calculate overall average RIR
      const allRirValues = Array.from(exerciseMap.values())
        .flatMap(e => e.rirValues);
      const avgRir = allRirValues.length > 0
        ? Number((allRirValues.reduce((sum, rir) => sum + rir, 0) / allRirValues.length).toFixed(1))
        : null;
      
      const totalExercises = exerciseMap.size;
      
      return {
        totalDays,
        totalExercises,
        totalSets,
        avgRir,
        exerciseAggregates
      };
    } catch (error) {
      console.error('Failed to calculate aggregate stats', error);
      return {
        totalDays: 0,
        totalExercises: 0,
        totalSets: 0,
        avgRir: null,
        exerciseAggregates: []
      };
    }
  },

  /**
   * Calculate exercise breakdown by workout group
   * Shows which days each exercise appears on
   */
  calculateExerciseBreakdown: (daysData, selectedDayIds) => {
    try {
      const selectedDays = daysData.filter(day => selectedDayIds.includes(day.id));
      
      if (selectedDays.length === 0) {
        return [];
      }
      
      // Build a map of exercises with their day appearances
      const exerciseMap = new Map();
      
      selectedDays.forEach(day => {
        day.exerciseBreakdown.forEach(exercise => {
          if (!exerciseMap.has(exercise.exerciseId)) {
            exerciseMap.set(exercise.exerciseId, {
              exerciseId: exercise.exerciseId,
              exerciseName: exercise.exerciseName,
              workoutGroupName: exercise.workoutGroupName,
              dayAppearances: [],
              totalSets: 0,
              allRirValues: []
            });
          }
          
          const exData = exerciseMap.get(exercise.exerciseId);
          exData.dayAppearances.push({
            dayId: day.id,
            dayName: day.name,
            setCount: exercise.setCount,
            avgRir: exercise.avgRir
          });
          exData.totalSets += exercise.setCount;
          
          // Collect RIR values for overall average
          if (exercise.avgRir !== null) {
            for (let i = 0; i < exercise.setCount; i++) {
              exData.allRirValues.push(exercise.avgRir);
            }
          }
        });
      });
      
      // Calculate overall stats and group by workout group
      const exerciseList = Array.from(exerciseMap.values()).map(exercise => {
        const avgRir = exercise.allRirValues.length > 0
          ? Number((exercise.allRirValues.reduce((sum, rir) => sum + rir, 0) / exercise.allRirValues.length).toFixed(1))
          : null;
        
        return {
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.exerciseName,
          workoutGroupName: exercise.workoutGroupName,
          dayAppearances: exercise.dayAppearances.sort((a, b) => a.dayName.localeCompare(b.dayName)),
          totalSets: exercise.totalSets,
          avgRir
        };
      });
      
      // Group by workout group
      const groupedByWorkoutGroup = exerciseList.reduce((groups, exercise) => {
        const groupName = exercise.workoutGroupName;
        if (!groups[groupName]) {
          groups[groupName] = [];
        }
        groups[groupName].push(exercise);
        return groups;
      }, {});
      
      // Convert to array and sort
      return Object.entries(groupedByWorkoutGroup)
        .map(([groupName, exercises]) => ({
          workoutGroupName: groupName,
          exercises: exercises.sort((a, b) => a.exerciseName.localeCompare(b.exerciseName))
        }))
        .sort((a, b) => a.workoutGroupName.localeCompare(b.workoutGroupName));
    } catch (error) {
      console.error('Failed to calculate exercise breakdown', error);
      return [];
    }
  }
};
