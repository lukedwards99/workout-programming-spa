# API Layer Implementation Plan

**Project:** Workout Programming SPA  
**Date:** January 25, 2026  
**Status:** READY FOR REVIEW

---

## Executive Summary

This plan outlines the creation of an API layer (`workoutApi.js`) that will sit between React components and the data service layer. This abstraction will standardize response formats, improve error handling, and facilitate future migration to a separate backend service.

---

## Goals

1. ✅ **Standardization**: Consistent response format across all data operations
2. ✅ **Error Handling**: Comprehensive try-catch with user-friendly messages
3. ✅ **Future-Proof**: Easy migration path to REST/GraphQL backend
4. ✅ **Maintainability**: Clear separation of concerns
5. ✅ **Type Safety**: Structure ready for TypeScript migration

---

## File Structure

```
workout-programming-spa/
├── src/
│   ├── api/
│   │   └── workoutApi.js          <- NEW FILE (main API layer)
│   ├── db/
│   │   ├── database.js             (existing)
│   │   ├── dataService.js          (existing - becomes internal only)
│   │   └── queries.js              (existing)
│   └── pages/
│       └── jsx/
│           ├── Setup.jsx           (update imports)
│           ├── DayWorkout.jsx      (update imports)
│           ├── WeekView.jsx        (update imports)
│           └── DataManagement.jsx  (update imports)
└── docs/
    └── API_SPECIFICATION.md        <- CREATED
```

---

## Implementation Steps

### Phase 1: Create API Layer Foundation ⏱️ ~30 minutes

#### Step 1.1: Create `workoutApi.js` structure
- [ ] Create `/src/api/workoutApi.js`
- [ ] Import all necessary functions from `dataService.js`
- [ ] Define response helper functions
- [ ] Define error handling utilities

**Files Created:**
- `src/api/workoutApi.js`

#### Step 1.2: Implement response formatters
```javascript
// Response helper functions
function successResponse(data, message = null)
function errorResponse(error, code = 'UNKNOWN_ERROR')
function handleApiCall(apiFunction, errorMessage)
```

---

### Phase 2: Implement API Endpoints ⏱️ ~1 hour

#### Step 2.1: Workout Groups API
Implement all workout group methods:
- `workoutGroupsApi.getAll()`
- `workoutGroupsApi.getById(id)`
- `workoutGroupsApi.create(data)`
- `workoutGroupsApi.update(id, data)`
- `workoutGroupsApi.delete(id)`

**Validation:**
- Name required and non-empty
- Name uniqueness check on create

#### Step 2.2: Exercises API
Implement all exercise methods:
- `exercisesApi.getAll()`
- `exercisesApi.getById(id)`
- `exercisesApi.getByWorkoutGroup(workoutGroupId)`
- `exercisesApi.getByWorkoutGroups(workoutGroupIds)`
- `exercisesApi.create(data)`
- `exercisesApi.update(id, data)`
- `exercisesApi.delete(id)`

**Validation:**
- Name required and non-empty
- Workout group ID must exist

#### Step 2.3: Days API
Implement all day methods:
- `daysApi.getAll()`
- `daysApi.getById(id)`
- `daysApi.getCount()`
- `daysApi.add(dayName)`
- `daysApi.removeLast()`

**Validation:**
- Day name required and non-empty
- Day name uniqueness check

#### Step 2.4: Day Workout Groups API
Implement:
- `dayWorkoutGroupsApi.getByDay(dayId)`
- `dayWorkoutGroupsApi.setForDay(dayId, workoutGroupIds)`

#### Step 2.5: Sets API
Implement:
- `setsApi.getAll()`
- `setsApi.getByDay(dayId)`
- `setsApi.getByDayGrouped(dayId)` - NEW METHOD for grouped data
- `setsApi.create(data)`
- `setsApi.update(id, data)`
- `setsApi.delete(id)`

**Validation:**
- Day ID must exist
- Exercise ID must exist
- Reps must be positive if provided
- RIR must be non-negative if provided

#### Step 2.6: Data Management API
Implement:
- `dataApi.export()`
- `dataApi.download()`
- `dataApi.import(csvString)`
- `dataApi.exportSetup()`
- `dataApi.downloadSetup()`
- `dataApi.importSetup(csvString)`
- `dataApi.clearWorkoutData()`
- `dataApi.clearAllData()`

#### Step 2.7: Program Generation API
Implement stub:
- `programApi.generate(options)`

---

### Phase 3: Update React Components ⏱️ ~45 minutes

#### Step 3.1: Update `Setup.jsx`
**Changes:**
```javascript
// OLD
import {
  getAllWorkoutGroups,
  createWorkoutGroup,
  updateWorkoutGroup,
  deleteWorkoutGroup,
  getAllExercises,
  createExercise,
  updateExercise,
  deleteExercise,
  downloadSetupDataCSV,
  importSetupDataFromCSV,
  clearAllData
} from '../../db/dataService';

// NEW
import { 
  workoutGroupsApi, 
  exercisesApi, 
  dataApi 
} from '../../api/workoutApi';
```

**Method Updates:**
- `loadData()` - Use new API methods with response handling
- `handleGroupSubmit()` - Use `workoutGroupsApi.create/update`
- `handleDeleteGroup()` - Use `workoutGroupsApi.delete`
- `handleExerciseSubmit()` - Use `exercisesApi.create/update`
- `handleDeleteExercise()` - Use `exercisesApi.delete`
- `handleExportSetupData()` - Use `dataApi.downloadSetup`
- `handleImportSetupData()` - Use `dataApi.importSetup`
- `handleClearAllData()` - Use `dataApi.clearAllData`

**Response Handling Pattern:**
```javascript
const loadData = async () => {
  try {
    const groupsResponse = await workoutGroupsApi.getAll();
    const exercisesResponse = await exercisesApi.getAll();
    
    if (groupsResponse.success) {
      setWorkoutGroups(groupsResponse.data);
    } else {
      showAlert(groupsResponse.error, 'danger');
    }
    
    if (exercisesResponse.success) {
      setExercises(exercisesResponse.data);
    } else {
      showAlert(exercisesResponse.error, 'danger');
    }
  } catch (error) {
    showAlert('Unexpected error: ' + error.message, 'danger');
  }
};
```

#### Step 3.2: Update `DayWorkout.jsx`
**Changes:**
```javascript
// OLD
import {
  getDayById,
  getAllWorkoutGroups,
  getDayWorkoutGroups,
  setDayWorkoutGroups,
  getExercisesByWorkoutGroups,
  getSetsByDay,
  createSet,
  updateSet,
  deleteSet
} from '../../db/dataService';

// NEW
import {
  daysApi,
  workoutGroupsApi,
  dayWorkoutGroupsApi,
  exercisesApi,
  setsApi
} from '../../api/workoutApi';
```

**Method Updates:**
- `loadData()` - Use new API methods
- `loadSets()` - Use `setsApi.getByDayGrouped()` for pre-grouped data
- `handleWorkoutGroupToggle()` - Use `dayWorkoutGroupsApi.setForDay`
- `handleAddSet()` - Use `setsApi.create`
- `handleUpdateSet()` - Use `setsApi.update`
- `handleDeleteSet()` - Use `setsApi.delete`

**Simplified Data Loading:**
```javascript
const loadData = async () => {
  const [dayResponse, groupsResponse, dayGroupsResponse] = await Promise.all([
    daysApi.getById(parseInt(dayId)),
    workoutGroupsApi.getAll(),
    dayWorkoutGroupsApi.getByDay(parseInt(dayId))
  ]);
  
  if (dayResponse.success) setDay(dayResponse.data);
  if (groupsResponse.success) setAllWorkoutGroups(groupsResponse.data);
  if (dayGroupsResponse.success) {
    const groupIds = dayGroupsResponse.data.map(g => g.workout_group_id);
    setSelectedWorkoutGroups(groupIds);
  }
  
  await loadSets();
};

const loadSets = async () => {
  const response = await setsApi.getByDayGrouped(parseInt(dayId));
  if (response.success) {
    setWorkoutSets(response.data);
  }
};
```

#### Step 3.3: Update `WeekView.jsx`
**Changes:**
```javascript
// OLD
import { 
  getAllDays, 
  getDayWorkoutGroups, 
  generateWorkoutProgram, 
  addDay, 
  removeLastDay
} from '../../db/dataService';

// NEW
import {
  daysApi,
  dayWorkoutGroupsApi,
  programApi
} from '../../api/workoutApi';
```

**Method Updates:**
- `loadData()` - Use new API methods
- `handleAutoProgramming()` - Use `programApi.generate`
- `handleAddDay()` - Use `daysApi.add`
- `handleRemoveLastDay()` - Use `daysApi.removeLast`

#### Step 3.4: Update `DataManagement.jsx`
**Changes:**
```javascript
// OLD
import { 
  downloadCSV, 
  importFromCSV, 
  exportToCSV, 
  clearWorkoutData 
} from '../../db/dataService';

// NEW
import { dataApi } from '../../api/workoutApi';
```

**Method Updates:**
- `handleExport()` - Use `dataApi.download`
- `handlePreview()` - Use `dataApi.export`
- `handleFileUpload()` - Use `dataApi.import`
- `handleClearWorkoutData()` - Use `dataApi.clearWorkoutData`

---

### Phase 4: Testing & Validation ⏱️ ~30 minutes

#### Step 4.1: Manual Testing Checklist
- [ ] **Setup Page**
  - [ ] Load workout groups and exercises
  - [ ] Create new workout group
  - [ ] Edit workout group
  - [ ] Delete workout group
  - [ ] Create new exercise
  - [ ] Edit exercise
  - [ ] Delete exercise
  - [ ] Export setup data
  - [ ] Import setup data
  - [ ] Clear all data

- [ ] **Day Workout Page**
  - [ ] Load day information
  - [ ] Select workout groups
  - [ ] Load exercises based on groups
  - [ ] Add sets
  - [ ] Edit sets (reps, RIR, notes)
  - [ ] Delete sets
  - [ ] View grouped sets display

- [ ] **Week View Page**
  - [ ] Load all days
  - [ ] View workout group badges
  - [ ] Add new day
  - [ ] Remove last day
  - [ ] Auto-generate program (stub)

- [ ] **Data Management Page**
  - [ ] Export workout data
  - [ ] Preview CSV
  - [ ] Import workout data
  - [ ] Clear workout data

#### Step 4.2: Error Handling Verification
- [ ] Test with invalid IDs
- [ ] Test with missing required fields
- [ ] Test with duplicate names
- [ ] Test import with invalid CSV format
- [ ] Verify user-friendly error messages displayed

#### Step 4.3: Edge Cases
- [ ] Empty database state
- [ ] Single day/group/exercise scenarios
- [ ] Large datasets (100+ exercises)
- [ ] Concurrent operations

---

## Code Structure

### `workoutApi.js` Organization

```javascript
// ===== UTILITIES =====
function successResponse(data, message = null) { ... }
function errorResponse(error, code = 'UNKNOWN_ERROR') { ... }
async function handleApiCall(apiFunction, errorMessage) { ... }

// ===== WORKOUT GROUPS API =====
export const workoutGroupsApi = {
  getAll: async () => { ... },
  getById: async (id) => { ... },
  create: async (data) => { ... },
  update: async (id, data) => { ... },
  delete: async (id) => { ... }
};

// ===== EXERCISES API =====
export const exercisesApi = { ... };

// ===== DAYS API =====
export const daysApi = { ... };

// ===== DAY WORKOUT GROUPS API =====
export const dayWorkoutGroupsApi = { ... };

// ===== SETS API =====
export const setsApi = { ... };

// ===== DATA MANAGEMENT API =====
export const dataApi = { ... };

// ===== PROGRAM GENERATION API =====
export const programApi = { ... };

// ===== DEFAULT EXPORT (Optional) =====
export default {
  workoutGroups: workoutGroupsApi,
  exercises: exercisesApi,
  days: daysApi,
  dayWorkoutGroups: dayWorkoutGroupsApi,
  sets: setsApi,
  data: dataApi,
  program: programApi
};
```

---

## Benefits

### Immediate Benefits
1. **Consistent Error Handling**: All operations have standardized error handling
2. **Better User Experience**: User-friendly error messages
3. **Code Organization**: Clear separation of concerns
4. **Easier Testing**: API layer can be mocked for component tests

### Future Benefits
1. **Backend Migration**: Simple swap of implementation
2. **Multiple Backends**: Could support both local and cloud storage
3. **Request Interceptors**: Easy to add auth, logging, etc.
4. **TypeScript Migration**: Clear interface definitions
5. **Optimistic Updates**: Can add UI optimizations
6. **Caching**: Can implement request caching
7. **Request Cancellation**: Can cancel in-flight requests

---

## Migration Considerations

### Breaking Changes
❌ **None** - This is additive only. The `dataService.js` remains unchanged.

### Backwards Compatibility
✅ **Full** - Old imports from `dataService.js` will still work if needed.

### Rollback Plan
If issues arise, components can revert to importing directly from `dataService.js`.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing functionality | Low | High | Comprehensive testing checklist |
| Performance degradation | Very Low | Medium | API layer is thin wrapper, minimal overhead |
| Increased bundle size | Low | Low | ~5-10KB for API layer |
| Developer confusion | Low | Low | Clear documentation and examples |

---

## Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Create API Layer | 30 min | None |
| Phase 2: Implement Endpoints | 60 min | Phase 1 |
| Phase 3: Update Components | 45 min | Phase 2 |
| Phase 4: Testing | 30 min | Phase 3 |
| **Total** | **~2.5 hours** | |

---

## Success Criteria

- ✅ All existing functionality works identically
- ✅ All API methods return standardized response format
- ✅ Error handling is comprehensive and user-friendly
- ✅ No direct imports of `dataService.js` in React components
- ✅ All tests pass
- ✅ Documentation is complete

---

## Next Steps

1. **Review** this implementation plan and API specification
2. **Approve** the approach and architecture
3. **Implement** following the phases outlined above
4. **Test** thoroughly using the testing checklist
5. **Document** any lessons learned or improvements

---

## Questions for Stakeholder

1. Should we add loading states to the API layer or keep in components?
2. Do you want request/response logging for debugging?
3. Should we add TypeScript type definitions now or later?
4. Any specific validation rules beyond what's documented?
5. Should the API layer handle alert/toast notifications or leave to components?

---

## Notes

- The API layer is designed to be a thin wrapper initially
- Validation can be enhanced based on business requirements
- Consider adding JSDoc comments for better IDE support
- Could add request debouncing for rapid operations
- Could add request queueing for offline support (future)
