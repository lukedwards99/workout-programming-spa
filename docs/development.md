# Development

## Architecture

The React client sends asynchronous JSON requests to a same-origin Hono Worker. D1 is the only application datastore. Every resource operation is scoped by `workspace_id`, and the Worker applies platform and workspace authorization before querying data.

The schema lives in `migrations/`. Local seed personas live in `seed/local.sql`. Wrangler persists the local database under the ignored `.wrangler/` directory.

## Commands

- `npm run db:setup` applies migrations and the idempotent local seed.
- `npm run dev` initializes D1 and starts the integrated app.
- `npm run typecheck` checks React, Worker, and test TypeScript.
- `npm run build` produces the Worker and client bundle.
- `npm run test:worker` runs isolated Worker/D1 tests.
- `npm run db:reset:local` intentionally resets and reseeds the normal local D1 database.
- `npm run test:e2e` resets `.wrangler/e2e`, then creates an isolated workspace and personas for each parallel Playwright test. It never writes test users to normal local D1 state.

## Programming model

Programs contain mesocycles, mesocycles contain workouts, and workouts contain exercise blocks and sets. Planned and executed values share each strength or cardio set row. There is no workout lifecycle. Program, mesocycle, and workout copy operations create independent rows and require an explicit `includeExecutedValues` choice.

## Authentication boundary

Local persona routes are available only when `APP_ENV` is `local` or `test` and local authentication is enabled. They set an HttpOnly, `SameSite=Lax` cookie. Future adapters should validate provider credentials, match provider subject first, then link only a single pre-created account with the same verified normalized email. Unknown identities must be rejected.

No remote D1 database or external identity provider is configured on this branch.
