# LiftLog

LiftLog is a browser-based workout programming tool for building strength and cardio programs, mesocycles, workouts, and exercise libraries. It runs entirely on your device: there are no accounts, servers, or cloud storage.

Your training data is stored in your browser using IndexedDB and SQLite compiled to WebAssembly. Keep backups of anything you want to preserve outside that browser.

## Try LiftLog

- [Production app](https://liftlog-lukedwards99.pages.dev/)
- Development app: `https://develop.liftlog-lukedwards99.pages.dev/`
  (available after the next push to `develop`)

## What it does

- Organize training programs into dated mesocycles and scheduled workouts.
- Build a separate typed Strength/Cardio exercise library for each program, including variations and notes.
- Plan and record strength sets with type, reps, weight, and RIR, plus cardio sets with duration, distance, and RPE.
- Copy workouts, generate repeated workout schedules, and review programmed training summaries.
- Export and restore program backups and exchange exercise libraries as JSON.

## Documentation

- [Documentation overview](docs/index.md)
- [Using LiftLog](docs/using-liftlog.md)
- [Data management and backups](docs/data-management.md)
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
```

For implementation details, testing expectations, and deployment behavior, see the [development guide](docs/development.md).
