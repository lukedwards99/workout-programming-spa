# Workout Programming SPA - API Specification

**Version:** 1.0.0  
**Date:** January 25, 2026  
**Status:** DRAFT

## Overview

This document defines the API layer that sits between the React UI components and the data service layer. The API layer provides a clean, consistent interface that abstracts data operations and will facilitate future migration to a separate backend service.

## Architecture Layers

```
┌─────────────────────────────────────┐
│   UI Layer (React Components)      │
│   - Setup.jsx                       │
│   - DayWorkout.jsx                  │
│   - WeekView.jsx                    │
│   - DataManagement.jsx              │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│   API Layer (workoutApi.js)        │
│   - Request/Response formatting     │
│   - Error handling                  │
│   - Validation                      │
│   - Loading states                  │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│   Data Service (dataService.js)     │
│   - Database operations             │
│   - CSV import/export               │
│   - Data transformations            │
└─────────────────────────────────────┘
```

## Design Principles

1. **Consistent Response Format**: All API methods return standardized response objects
2. **Error Handling**: Comprehensive error catching and user-friendly error messages
3. **Async/Promise-based**: All methods are async and return promises
4. **Type Safety Ready**: Structure supports TypeScript migration
5. **Loading States**: Built-in loading state management
6. **Validation**: Input validation before reaching data layer
7. **Future-Proof**: Designed to easily swap out for REST/GraphQL backend

## Response Format

### Success Response
```javascript
{
  success: true,
  data: <result>,
  message?: <optional success message>
}
```

### Error Response
```javascript
{
  success: false,
  error: <error message>,
  code?: <error code>
}
```

---

## API Endpoints

### 1. Workout Groups API

#### `workoutGroupsApi.getAll()`
**Purpose**: Fetch all workout groups  
**Returns**: `Promise<ApiResponse<WorkoutGroup[]>>`

**Response Data Shape**:
```javascript
{
  id: number,
  name: string,
  notes: string
}[]
```

#### `workoutGroupsApi.getById(id)`
**Purpose**: Fetch a single workout group  
**Parameters**: 
- `id` (number) - Workout group ID

**Returns**: `Promise<ApiResponse<WorkoutGroup>>`

#### `workoutGroupsApi.create(data)`
**Purpose**: Create a new workout group  
**Parameters**:
- `data` (object)
  - `name` (string, required) - Group name
  - `notes` (string, optional) - Group notes

**Returns**: `Promise<ApiResponse<{id: number}>>`

**Validation**:
- `name` must be non-empty string
- `name` must be unique

#### `workoutGroupsApi.update(id, data)`
**Purpose**: Update an existing workout group  
**Parameters**:
- `id` (number) - Workout group ID
- `data` (object)
  - `name` (string, required)
  - `notes` (string, optional)

**Returns**: `Promise<ApiResponse<{id: number}>>`

#### `workoutGroupsApi.delete(id)`
**Purpose**: Delete a workout group and all associated exercises and sets  
**Parameters**:
- `id` (number) - Workout group ID

**Returns**: `Promise<ApiResponse<void>>`

**Side Effects**: Cascades deletion to exercises and sets

---

### 2. Exercises API

#### `exercisesApi.getAll()`
**Purpose**: Fetch all exercises with workout group info  
**Returns**: `Promise<ApiResponse<Exercise[]>>`

**Response Data Shape**:
```javascript
{
  id: number,
  workout_group_id: number,
  workout_group_name: string,
  name: string,
  notes: string
}[]
```

#### `exercisesApi.getById(id)`
**Purpose**: Fetch a single exercise  
**Parameters**:
- `id` (number) - Exercise ID

**Returns**: `Promise<ApiResponse<Exercise>>`

#### `exercisesApi.getByWorkoutGroup(workoutGroupId)`
**Purpose**: Fetch exercises for a specific workout group  
**Parameters**:
- `workoutGroupId` (number) - Workout group ID

**Returns**: `Promise<ApiResponse<Exercise[]>>`

#### `exercisesApi.getByWorkoutGroups(workoutGroupIds)`
**Purpose**: Fetch exercises for multiple workout groups  
**Parameters**:
- `workoutGroupIds` (number[]) - Array of workout group IDs

**Returns**: `Promise<ApiResponse<Exercise[]>>`

#### `exercisesApi.create(data)`
**Purpose**: Create a new exercise  
**Parameters**:
- `data` (object)
  - `workoutGroupId` (number, required)
  - `name` (string, required)
  - `notes` (string, optional)

**Returns**: `Promise<ApiResponse<{id: number}>>`

**Validation**:
- `workoutGroupId` must exist
- `name` must be non-empty string

#### `exercisesApi.update(id, data)`
**Purpose**: Update an existing exercise  
**Parameters**:
- `id` (number) - Exercise ID
- `data` (object)
  - `workoutGroupId` (number, required)
  - `name` (string, required)
  - `notes` (string, optional)

**Returns**: `Promise<ApiResponse<{id: number}>>`

#### `exercisesApi.delete(id)`
**Purpose**: Delete an exercise and all associated sets  
**Parameters**:
- `id` (number) - Exercise ID

**Returns**: `Promise<ApiResponse<void>>`

**Side Effects**: Cascades deletion to sets

---

### 3. Days API

#### `daysApi.getAll()`
**Purpose**: Fetch all days in order  
**Returns**: `Promise<ApiResponse<Day[]>>`

**Response Data Shape**:
```javascript
{
  id: number,
  day_name: string,
  day_order: number
}[]
```

#### `daysApi.getById(id)`
**Purpose**: Fetch a single day  
**Parameters**:
- `id` (number) - Day ID

**Returns**: `Promise<ApiResponse<Day>>`

#### `daysApi.getCount()`
**Purpose**: Get total number of days  
**Returns**: `Promise<ApiResponse<{count: number}>>`

#### `daysApi.add(dayName)`
**Purpose**: Add a new day to the program  
**Parameters**:
- `dayName` (string, required) - Name of the day

**Returns**: `Promise<ApiResponse<{id: number}>>`

**Validation**:
- `dayName` must be non-empty string
- `dayName` must be unique

#### `daysApi.removeLast()`
**Purpose**: Remove the last day and all associated data  
**Returns**: `Promise<ApiResponse<void>>`

**Validation**:
- Must have at least one day to remove

---

### 4. Day Workout Groups API

#### `dayWorkoutGroupsApi.getByDay(dayId)`
**Purpose**: Fetch workout groups assigned to a specific day  
**Parameters**:
- `dayId` (number) - Day ID

**Returns**: `Promise<ApiResponse<DayWorkoutGroup[]>>`

**Response Data Shape**:
```javascript
{
  id: number,
  day_id: number,
  workout_group_id: number,
  workout_group_name: string
}[]
```

#### `dayWorkoutGroupsApi.setForDay(dayId, workoutGroupIds)`
**Purpose**: Replace all workout groups for a day  
**Parameters**:
- `dayId` (number) - Day ID
- `workoutGroupIds` (number[]) - Array of workout group IDs

**Returns**: `Promise<ApiResponse<void>>`

**Behavior**: Deletes existing associations and creates new ones

---

### 5. Sets API

#### `setsApi.getAll()`
**Purpose**: Fetch all sets  
**Returns**: `Promise<ApiResponse<Set[]>>`

#### `setsApi.getByDay(dayId)`
**Purpose**: Fetch all sets for a specific day with exercise info  
**Parameters**:
- `dayId` (number) - Day ID

**Returns**: `Promise<ApiResponse<Set[]>>`

**Response Data Shape**:
```javascript
{
  id: number,
  day_id: number,
  exercise_id: number,
  exercise_name: string,
  workout_group_id: number,
  workout_group_name: string,
  exercise_notes: string,
  set_order: number,
  reps: number,
  rir: number,
  notes: string
}[]
```

#### `setsApi.getByDayGrouped(dayId)`
**Purpose**: Fetch sets grouped by exercise for a specific day  
**Parameters**:
- `dayId` (number) - Day ID

**Returns**: `Promise<ApiResponse<GroupedSets>>`

**Response Data Shape**:
```javascript
{
  [exerciseId]: {
    exerciseId: number,
    exerciseName: string,
    workoutGroupId: number,
    workoutGroupName: string,
    exerciseNotes: string,
    sets: [
      {
        id: number,
        set_order: number,
        reps: number,
        rir: number,
        notes: string
      }
    ]
  }
}
```

#### `setsApi.create(data)`
**Purpose**: Create a new set  
**Parameters**:
- `data` (object)
  - `dayId` (number, required)
  - `exerciseId` (number, required)
  - `reps` (number, optional)
  - `rir` (number, optional)
  - `notes` (string, optional)

**Returns**: `Promise<ApiResponse<{id: number}>>`

**Validation**:
- `dayId` must exist
- `exerciseId` must exist
- `reps` must be positive number if provided
- `rir` must be non-negative number if provided

#### `setsApi.update(id, data)`
**Purpose**: Update a set  
**Parameters**:
- `id` (number) - Set ID
- `data` (object)
  - `setOrder` (number, optional)
  - `reps` (number, optional)
  - `rir` (number, optional)
  - `notes` (string, optional)

**Returns**: `Promise<ApiResponse<void>>`

#### `setsApi.delete(id)`
**Purpose**: Delete a set  
**Parameters**:
- `id` (number) - Set ID

**Returns**: `Promise<ApiResponse<void>>`

---

### 6. Data Management API

#### `dataApi.export()`
**Purpose**: Export all workout data to CSV format  
**Returns**: `Promise<ApiResponse<{csv: string}>>`

#### `dataApi.download()`
**Purpose**: Trigger CSV download in browser  
**Returns**: `Promise<ApiResponse<{filename: string}>>`

#### `dataApi.import(csvString)`
**Purpose**: Import workout data from CSV  
**Parameters**:
- `csvString` (string, required) - CSV content

**Returns**: `Promise<ApiResponse<{rowCount: number}>>`

**Side Effects**: Clears existing sets before import

#### `dataApi.exportSetup()`
**Purpose**: Export setup data (workout groups & exercises) to CSV  
**Returns**: `Promise<ApiResponse<{csv: string}>>`

#### `dataApi.downloadSetup()`
**Purpose**: Trigger setup CSV download in browser  
**Returns**: `Promise<ApiResponse<{filename: string}>>`

#### `dataApi.importSetup(csvString)`
**Purpose**: Import setup data from CSV  
**Parameters**:
- `csvString` (string, required) - CSV content

**Returns**: `Promise<ApiResponse<{rowCount: number}>>`

**Side Effects**: Clears existing workout groups, exercises, and all related data

#### `dataApi.clearWorkoutData()`
**Purpose**: Clear all workout data (sets and day associations)  
**Returns**: `Promise<ApiResponse<void>>`

**Side Effects**: Preserves workout groups and exercises

#### `dataApi.clearAllData()`
**Purpose**: Clear all data (complete database reset)  
**Returns**: `Promise<ApiResponse<void>>`

**Side Effects**: Clears workout groups, exercises, days, and all associations

---

### 7. Program Generation API

#### `programApi.generate(options)`
**Purpose**: Auto-generate workout program  
**Parameters**:
- `options` (object, optional) - Generation options (future use)

**Returns**: `Promise<ApiResponse<{message: string}>>`

**Status**: Stub for future implementation

---

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Input validation failed |
| `NOT_FOUND` | Resource not found |
| `DATABASE_ERROR` | Database operation failed |
| `IMPORT_ERROR` | CSV import failed |
| `EXPORT_ERROR` | CSV export failed |
| `UNKNOWN_ERROR` | Unexpected error |

---

## Usage Examples

### Component Pattern

```javascript
import { workoutGroupsApi, exercisesApi } from '../../api/workoutApi';

function MyComponent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    const response = await workoutGroupsApi.getAll();
    
    if (response.success) {
      setData(response.data);
    } else {
      setError(response.error);
    }
    
    setLoading(false);
  };

  const createGroup = async (name, notes) => {
    const response = await workoutGroupsApi.create({ name, notes });
    
    if (response.success) {
      showSuccessMessage('Group created!');
      loadData(); // Refresh
    } else {
      showErrorMessage(response.error);
    }
  };

  return (
    // Component JSX
  );
}
```

---

## Migration Path

### Phase 1: Client-Side API Layer (Current)
- API layer wraps dataService.js
- All operations remain client-side
- Standardized response format

### Phase 2: Backend Preparation
- Add request/response serialization
- Add authentication headers (if needed)
- Add network error handling

### Phase 3: Backend Integration
- Swap implementation to use fetch/axios
- Point to backend endpoints
- Minimal changes to UI components

---

## Notes

- All database operations currently use sql.js (client-side)
- Future backend will use PostgreSQL/MySQL
- API layer provides abstraction for this transition
- Consider adding request cancellation for long operations
- Consider adding optimistic updates for better UX
