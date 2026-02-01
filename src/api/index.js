/**
 * Workout API - Main Entry Point
 * 
 * Barrel export for all API modules.
 * This file re-exports all API modules to maintain backward compatibility.
 * 
 * Usage:
 * import { workoutGroupsApi, exercisesApi, daysApi } from './api';
 * 
 * Or import individual modules:
 * import { workoutGroupsApi } from './api/workoutGroupsApi';
 */

export { workoutGroupsApi } from './workoutGroupsApi.js';
export { exercisesApi } from './exercisesApi.js';
export { daysApi } from './daysApi.js';
export { dayWorkoutGroupsApi } from './dayWorkoutGroupsApi.js';
export { workoutSetsApi } from './workoutSetsApi.js';
export { dataApi } from './dataApi.js';
export { programApi } from './programApi.js';
