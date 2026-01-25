# Workout Programming App

A browser-based workout programming application built with React, Vite, and SQLite. Designed specifically for weight training program management with CSV export/import functionality.

## Features

- **Browser-Based Database**: Uses SQLite (sql.js) with IndexedDB persistence - no server required
- **Workout Management**: Create and organize workout groups (Chest, Back, Legs, etc.) and exercises
- **Weekly Programming**: Plan workouts for each day of the week
- **Set Tracking**: Track sets with reps, RIR (Reps in Reserve), and notes
- **CSV Export/Import**: Export your program to CSV for tracking, then re-import with updates
- **Responsive Design**: Built with React Bootstrap for mobile and desktop

## Tech Stack

- React 18
- Vite
- React Router DOM
- React Bootstrap
- SQLite (sql.js)
- PapaParse (CSV handling)

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd workout-programming-spa
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to `http://localhost:5173`

## Usage

### Setup Workout Groups & Exercises

1. Navigate to **Setup** page
2. Create workout groups (e.g., Chest, Back, Legs, Arms, Cardio, Rest)
3. Add exercises to each workout group
4. Add optional notes to exercises

### Build Your Weekly Program

1. Go to the **Week View** (home page)
2. Click on any day card
3. Select which workout groups you want to train that day
4. Add sets for exercises from your selected groups
5. Configure reps, RIR, and notes for each set

### Export & Import

1. Navigate to **Data Management**
2. Click **Download CSV** to export your program
3. Open the CSV in Excel or Google Sheets
4. Make changes (update reps, add notes, etc.)
5. Save and upload the file to import changes

## Database Schema

The app uses a normalized SQLite database:

- **days**: 7 static records (Monday-Sunday)
- **workout_groups**: User-defined categories
- **exercises**: Linked to workout groups
- **day_workout_groups**: Junction table (which groups on which days)
- **sets**: Day-specific workout data (reps, RIR, notes)

See [ddl.sql](ddl.sql) for complete schema.

## CSV Format

When exported, data is denormalized into a single table with columns:
- day_name, day_order, workout_group_name
- exercise_name, exercise_notes, set_order
- reps, rir, set_notes

## Project Structure

```
src/
├── db/                     # Data layer
│   ├── database.js         # SQLite initialization & persistence
│   ├── queries.js          # SQL query strings
│   └── dataService.js      # CRUD operations & CSV handling
├── components/
│   ├── jsx/               # Reusable components
│   │   ├── Navigation.jsx
│   │   └── Footer.jsx
│   └── css/
├── pages/
│   ├── jsx/               # Page components
│   │   ├── WeekView.jsx   # Home/dashboard
│   │   ├── Setup.jsx      # Manage groups/exercises
│   │   ├── DayWorkout.jsx # Build daily workout
│   │   └── DataManagement.jsx # CSV export/import
│   └── css/
├── App.jsx                # Main app component
└── main.jsx               # Entry point
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Data Persistence

- Database automatically saves to IndexedDB on every change
- Data persists across browser sessions
- Clear browser data to reset the database

## Future Enhancements

- **Auto-Programming Feature**: Automatically generate workout programs (currently stubbed)
- **Progressive Overload Tracking**: Track weight increases over time
- **Exercise History**: View historical data for exercises
- **Multi-Week Programs**: Plan multiple weeks in advance
- **Exercise Library**: Pre-populated exercise database with instructions

## Browser Compatibility

Works on all modern browsers that support:
- ES6+ JavaScript
- IndexedDB
- WebAssembly (for sql.js)

## Contributing

This is a personal project, but suggestions and feedback are welcome!

## License

MIT License

## Author

Luke Edwards

---

**Note**: This application stores all data locally in your browser. Make regular CSV backups to prevent data loss.
