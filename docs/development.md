# Development guide

## Requirements and setup

Use Node.js 20 and npm.

```bash
npm ci
npm run dev
```

Vite serves the application locally at `http://localhost:5173`.

## Commands

```bash
# Type-check without writing output
npm run typecheck

# Build the production bundle
npm run build

# Serve the most recent production build
npm run preview

# Run the Chromium E2E suite
npm run test:e2e

# Open Playwright's interactive runner
npm run test:e2e:ui
```

The E2E suite starts Vite automatically. Install the required Playwright browser first when needed:

```bash
npx playwright install
```

## Architecture

- `src/pages/` contains the routed program, mesocycle, workout, summary, and help screens.
- `src/components/` contains shared UI, summary, and workout-generator components.
- `src/api/` contains domain operations for programs, exercises, workouts, summaries, imports, exports, and generation.
- `src/db/` owns SQL.js initialization, SQLite schemas, IndexedDB persistence, active-program stores, and backup handling.
- `src/planning/` contains workout-generation algorithms and their types.
- `src/types/` defines domain, API, and database TypeScript contracts.
- `tests/e2e/` provides Playwright coverage for user workflows and regression cases.

The client is React with Vite and TypeScript. Each program has an isolated browser-local SQLite store backed by IndexedDB; the catalog records the available programs. There is no server-side application database or authentication service.

## Validation expectations

Run `npm run typecheck` and `npm run build` for every code change. Run `npm run test:e2e` when a change affects a user workflow, persistence, imports/exports, routing, or UI behavior.

## GitHub Pages deployments

The GitHub Actions workflow deploys both branches on pushes to `main` or `develop`:

- `main` is built as the production site at `https://lukedwards99.github.io/workout-programming-spa/`.
- `develop` is built into the development site at `https://lukedwards99.github.io/workout-programming-spa/dev/`.

The workflow checks out both branches, installs dependencies with `npm ci`, builds each one with its matching base path, combines the output, and publishes it to GitHub Pages. The repository's router and fallback page are configured to work beneath both paths.
