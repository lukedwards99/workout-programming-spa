# Agent Guidelines for Workout Programming SPA

**Last Updated:** January 25, 2026  
**Project:** Workout Programming SPA  
**Developer:** Luke Edwards

---

## Overview

This is a client-side workout programming application built with React, Vite, and sql.js. The app allows users to create workout groups, exercises, and build weekly workout programs. All data is stored locally in the browser using IndexedDB.

**Key Characteristics:**
- Single Page Application (SPA)
- Client-side only (no backend yet)
- Mobile-responsive design
- Data persistence via IndexedDB
- CSV export/import for data portability

---

## Project Philosophy

### 1. **Future-Proof Architecture**
The entire architecture is designed for easy migration to a backend service:
- **API Layer** abstracts data operations from UI
- **Standardized responses** mimic REST API patterns
- **Separation of concerns** makes swapping implementations simple

### 2. **Documentation Before Implementation**
Always create comprehensive documentation before coding:
- Write specifications first
- Create implementation plans with clear phases
- Document decisions and trade-offs
- Get approval before proceeding with implementation

### 3. **Clean Code Principles**
- Clear separation of concerns (UI → API → Data Service)
- Consistent naming conventions
- Comprehensive error handling
- User-friendly error messages

---

## Coding Preferences

### React & JavaScript

**Component Style:**
- Use functional components with hooks
- No class components
- Prefer async/await over promises
- Use modern ES6+ syntax

**State Management:**
- useState and useEffect for local state
- No Redux or external state management (for now)
- Keep component state simple and focused

**Error Handling:**
- Always use try-catch for async operations
- Return errors to components for display
- Provide user-friendly error messages
- Log errors to console for debugging

**Code Organization:**
```javascript
// Good: Clear, descriptive function names
const handleAddWorkoutGroup = async () => { ... }

// Good: Destructured imports
import { workoutGroupsApi, exercisesApi } from '../../api/workoutApi';

// Good: Consistent response handling
const response = await workoutGroupsApi.create(data);
if (response.success) {
  showAlert(response.message);
  loadData();
} else {
  showAlert(response.error, 'danger');
}
```

### File Structure

**Strict Organization:**
```
src/
├── api/                    # API layer (abstracts data service)
│   └── workoutApi.js
├── db/                     # Data service (database operations)
│   ├── database.js
│   ├── dataService.js
│   └── queries.js
├── components/
│   ├── jsx/               # Component implementations
│   └── css/               # Component-specific styles
└── pages/
    ├── jsx/               # Page components
    └── css/               # Page-specific styles
```

**Naming Conventions:**
- Files: PascalCase for components (`Setup.jsx`)
- API modules: camelCase with descriptive names (`workoutGroupsApi`)
- CSS: PascalCase matching component name (`Setup.css`)

---

## Architecture Layers

### Layer 1: UI (React Components)
**Purpose:** Presentation and user interaction  
**Responsibilities:**
- Render UI
- Handle user input
- Display loading states
- Show alerts/errors
- Manage local UI state

**Never:**
- Direct database operations
- CSV parsing/generation
- Complex data transformations

### Layer 2: API Layer (`src/api/workoutApi.js`)
**Purpose:** Abstract data operations with consistent interface  
**Responsibilities:**
- Input validation
- Error handling
- Standardized response format
- CSV import/export logic
- Data transformations for UI

**Response Format:**
```javascript
// Success
{ success: true, data: <result>, message?: <string> }

// Error
{ success: false, error: <string>, code?: <string> }
```

### Layer 3: Data Service (`src/db/dataService.js`)
**Purpose:** Database operations and queries  
**Responsibilities:**
- CRUD operations
- SQL query execution
- IndexedDB persistence
- Data consistency

---

## Key Patterns

### 1. API Response Handling
Always handle both success and error cases:

```javascript
const loadData = async () => {
  const response = await someApi.getData();
  
  if (response.success) {
    setData(response.data);
  } else {
    showAlert(response.error, 'danger');
  }
};
```

### 2. Form Submissions
Reset forms and reload data after successful operations:

```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  
  const response = await api.create(formData);
  
  if (response.success) {
    showAlert(response.message);
    resetForm();
    loadData();
  } else {
    showAlert(response.error, 'danger');
  }
};
```

### 3. Data Loading
Use async/await and handle errors gracefully:

```javascript
useEffect(() => {
  loadData();
}, [dependency]);

const loadData = async () => {
  const response = await api.getAll();
  if (response.success) {
    setData(response.data);
  }
};
```

---

## Data Schema

### Core Entities

**workout_groups** - Categories of exercises
- id, name, notes

**exercises** - Individual exercises
- id, workout_group_id, name, notes

**days** - Days in workout program
- id, day_name, day_order

**day_workout_groups** - Which groups are worked each day
- id, day_id, workout_group_id

**sets** - Individual sets in workouts
- id, day_id, exercise_id, set_order, reps, rir, notes

---

## Important Constraints

### User Experience
1. **Always confirm destructive actions** with `window.confirm()`
2. **Show success messages** after operations complete
3. **Provide clear error messages** that users can understand
4. **Reload data after mutations** to ensure UI stays in sync

### Data Integrity
1. **Check for duplicate names** before creating workout groups/exercises/days
2. **Validate required fields** at API layer
3. **Cascade deletions** properly (workout group → exercises → sets)
4. **Preserve workout groups/exercises** when clearing workout data

### Performance
1. **Group sets by exercise** for display (use `setsApi.getByDayGrouped()`)
2. **Batch database operations** where possible
3. **Minimize re-renders** by managing state effectively

---

## Common Tasks

### Adding a New API Endpoint

1. **Add to data service** (`dataService.js`)
2. **Create API method** in `workoutApi.js` with proper validation
3. **Update components** to use new API method
4. **Test thoroughly**

Example:
```javascript
// 1. Data service
export async function newDataOperation() { ... }

// 2. API layer
export const someApi = {
  newMethod: async (data) => {
    try {
      validateRequired(data.field, 'Field name');
      const result = await newDataOperation();
      return successResponse(result, 'Success message');
    } catch (error) {
      return errorResponse(error, 'VALIDATION_ERROR');
    }
  }
};

// 3. Component
const handleAction = async () => {
  const response = await someApi.newMethod(data);
  if (response.success) { ... }
};
```

### Adding a New Page

1. Create JSX in `src/pages/jsx/`
2. Create CSS in `src/pages/css/`
3. Add route in `App.jsx`
4. Use existing API methods where possible

---

## Testing Checklist

When making changes, always verify:

- [ ] Build succeeds (`npm run build`)
- [ ] Dev server runs without errors (`npm run dev`)
- [ ] No console errors in browser
- [ ] CRUD operations work (create, read, update, delete)
- [ ] CSV export/import functions properly
- [ ] Error messages display correctly
- [ ] Confirmation dialogs appear for destructive actions
- [ ] Data persists after page refresh
- [ ] Mobile responsiveness maintained

---

## Dependencies

**Core:**
- React 18+ (UI framework)
- React Router (routing)
- Bootstrap 5 + React-Bootstrap (UI components)
- Vite (build tool)

**Data:**
- sql.js (client-side SQLite)
- PapaParse (CSV parsing)

**Important:** All dependencies are client-side. No server-side code exists (yet).

---

## Future Roadmap

### Phase 1: Current State ✅
- Client-side SPA with local storage
- API layer abstraction
- CSV export/import

### Phase 2: Planned
- Backend API (REST or GraphQL)
- User authentication
- Cloud data sync
- Multi-device support

### Phase 3: Potential
- Progressive Web App (PWA)
- Offline support
- Advanced analytics
- Social features

---

## Working with Luke

### Communication Style
- **Approvals first**: Present specs and plans before implementing
- **Documentation**: Create clear docs that can be referenced later
- **Incremental changes**: Break large tasks into smaller, testable phases
- **No surprises**: Explain changes and their impact

### Decision Making
- **Future-proof**: Design for where the project is going, not just where it is
- **Keep it simple**: Don't over-engineer early; build what's needed
- **User experience first**: Features should be intuitive and helpful
- **Data integrity**: Never compromise on data consistency

### Code Reviews
- Clean, readable code is preferred over clever code
- Comments for complex logic, but code should be self-documenting
- Consistent patterns across the codebase
- Error handling is not optional

---

## Quick Reference

### File Locations
- **API Layer**: `src/api/workoutApi.js`
- **Data Service**: `src/db/dataService.js`
- **Main Pages**: `src/pages/jsx/*.jsx`
- **Database Queries**: `src/db/queries.js`
- **Documentation**: `docs/`

### Key APIs
```javascript
import {
  workoutGroupsApi,  // Workout group CRUD
  exercisesApi,      // Exercise CRUD
  daysApi,           // Day management
  dayWorkoutGroupsApi, // Day-group associations
  setsApi,           // Set CRUD and grouped queries
  dataApi,           // CSV export/import, data clearing
  programApi         // Auto-generation (stub)
} from '../api/workoutApi';
```

### Bootstrap Components Used
- Container, Row, Col (layout)
- Card, Card.Header, Card.Body (containers)
- Form, Form.Control, Form.Select (forms)
- Button, Badge (UI elements)
- Alert (messages)
- Modal (dialogs)
- Table (data display)
- ListGroup (lists)

---

## Notes for AI Agents

### Before Starting Work:
1. **Read this file completely**
2. **Check existing documentation** in `docs/`
3. **Understand the three-layer architecture**
4. **Review similar existing code** for patterns
5. **Ask for clarification** if requirements are unclear

### When Writing Code:
1. **Follow established patterns** (don't reinvent)
2. **Use the API layer** (never import from dataService in components)
3. **Handle all error cases** (success and failure)
4. **Provide user feedback** (alerts, loading states)
5. **Validate inputs** at the API layer
6. **Test your changes** before declaring complete

### When Documenting:
1. **Be specific and actionable**
2. **Include code examples**
3. **Explain the "why" not just the "what"**
4. **Update docs when code changes**
5. **Create specs before implementing**

---

## Emergency Contacts

**Repository Issues:** Check existing patterns in codebase first  
**Build Failures:** Verify all imports are correct  
**Data Corruption:** User should export CSV before destructive operations  
**Browser Compatibility:** Modern browsers only (ES6+, IndexedDB support required)

---

## Version History

- **v1.0** (Jan 2026): Initial API layer implementation
- Three-layer architecture established
- CSV import/export functionality
- Complete workout programming features

---

**Remember:** This project is designed for future expansion. Keep the architecture clean, the code maintainable, and always think about the next developer (or AI) who will work on this code.
