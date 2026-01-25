# Workout Programming App - Technical Specifications

## Overview
Browser-based workout programming application built with React, Vite, and SQLite (sql.js). Designed for weight training program management with CSV export/import functionality.

## Technology Stack
- **Frontend:** React 18 with JavaScript
- **Build Tool:** Vite
- **UI Framework:** React Bootstrap 5
- **Database:** SQLite (sql.js) with IndexedDB persistence
- **Data Exchange:** CSV export/import
- **Routing:** React Router DOM

## Core Features

### 1. Data Management
- Browser-based SQLite database
- Auto-save to IndexedDB
- CSV export (denormalized single table)
- CSV import with normalization

### 2. Workout Structure
- **7 Days:** Fixed weekly structure (Monday-Sunday)
- **Workout Groups:** Muscle groups, rest, cardio categories
- **Exercises:** Generic exercises assigned to workout groups
- **Sets:** Day-specific workout data (reps, RIR, notes)

### 3. User Workflows

#### Setup Workflow
1. Create workout groups (e.g., Chest, Back, Legs, Rest)
2. Add exercises to each workout group
3. Add notes to exercises

#### Programming Workflow
1. View week overview
2. Select a day
3. Choose workout groups for that day
4. Add exercises from selected groups
5. Define sets for each exercise (reps, RIR, notes)

#### Data Management Workflow
1. Export entire program to CSV
2. Use CSV throughout the week
3. Re-upload CSV to update program

## Database Schema

### Normalized Structure (SQLite)
See [ddl.sql](../ddl.sql) for complete schema.

**Tables:**
- `days` - 7 static records
- `workout_groups` - User-defined categories
- `exercises` - Linked to workout groups
- `day_workout_groups` - Junction table
- `sets` - Day-specific workout data

### CSV Export Format
Single denormalized table with columns:
- day_name, day_order, workout_group_name
- exercise_name, exercise_notes, set_order
- reps, rir, set_notes

## Application Structure

### Pages
- **Week View** (`/`) - Dashboard with 7-day overview
- **Setup** (`/setup`) - Manage workout groups and exercises
- **Day Workout** (`/day/:dayId`) - Build workout for specific day
- **Data Management** (`/data`) - CSV export/import

### Components
- Navigation - App-wide navigation bar
- Footer - App footer
- ExerciseCard - Display exercise information
- SetRow - Input row for set data
- WorkoutGroupBadge - Visual indicator for workout groups

## Future Enhancements
- Auto-programming feature (stubbed)
- Progressive overload tracking
- Exercise history and analytics
- Multi-week program planning

## Development Commands
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```
