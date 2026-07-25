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

## Deployments

Cloudflare Pages is the primary deployment platform:

- `main` deploys to `https://liftlog-lukedwards99.pages.dev/`.
- `develop` deploys to `https://develop.liftlog-lukedwards99.pages.dev/`
  after its next push.
- Every non-production branch gets a stable preview alias and an immutable
  commit-specific deployment.
- Branch aliases are lowercased and non-alphanumeric characters become hyphens,
  so `feat/example` becomes `feat-example.<project>.pages.dev`.
- Pull requests from branches in this repository include a preview deployment
  check and URL. Pull requests from forks do not receive automatic previews.

Cloudflare builds from the repository root with Node.js 20, uses the root base
path, and publishes `dist`. The production branch is `main`, and preview
deployment controls include all non-production branches.
