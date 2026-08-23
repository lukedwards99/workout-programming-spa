# LiftLog

LiftLog is a coach–client workout-programming proof of concept built with React, a Hono Cloudflare Worker, and D1. Local development uses Cloudflare's Vite integration, so the browser app and same-origin API run in one Workers runtime.

## Local development

```bash
npm install
npm run dev
```

`npm run dev` applies D1 migrations, runs idempotent local seeds, and starts the integrated app. Select one of the seeded owner, coach, or client personas on the local login screen.

Useful checks:

```bash
npm run typecheck
npm run build
npm run test:worker
npm run test:e2e
```

The current branch is local-only. It does not configure a remote Cloudflare database or external identity provider.

See [development notes](docs/development.md) and [using LiftLog](docs/using-liftlog.md).
