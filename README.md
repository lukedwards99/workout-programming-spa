# LiftLog

LiftLog is a browser-based workout programming tool for building strength-training programs, mesocycles, workouts, and exercise libraries. It runs entirely on your device: there are no accounts, servers, or cloud storage.

Your training data is stored in your browser using IndexedDB and SQLite compiled to WebAssembly. Keep backups of anything you want to preserve outside that browser.

## Try LiftLog

- [Production app](https://lukedwards99.github.io/workout-programming-spa/)
- [Development app](https://lukedwards99.github.io/workout-programming-spa/dev/)

## What it does

- Organize training programs into dated mesocycles and scheduled workouts.
- Build a separate exercise library for each program, including variations and notes.
- Plan and record sets with type, planned and actual reps, weight, RIR, and notes.
- Copy workouts, generate repeated workout schedules, and review programmed training summaries.
- Export and restore program backups, exchange exercise libraries as JSON, and edit a mesocycle in Excel.

## Documentation

- [Documentation overview](docs/index.md)
- [Using LiftLog](docs/using-liftlog.md)
- [Data management and backups](docs/data-management.md)
- [Mesocycle spreadsheets](docs/mesocycle-spreadsheets.md)
- [Development guide](docs/development.md)

## Develop locally

Prerequisites: Node.js 20 and npm.

```bash
npm ci
npm run dev
```

The development server runs at `http://localhost:5173`.

Useful commands:

```bash
npm run typecheck
npm run build
npm run preview
npm run test:e2e
npm run test:e2e:ui
```

If Playwright has not installed its browser binary on your machine, run `npx playwright install` before the E2E commands.

## Project layout

```text
src/             React application, domain APIs, and browser-local data layer
tests/e2e/       Playwright end-to-end coverage
docs/            User and developer documentation
.github/         GitHub Pages deployment workflow
```

For implementation details, testing expectations, and deployment behavior, see the [development guide](docs/development.md).
