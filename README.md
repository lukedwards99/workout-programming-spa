# LiftLog

A React workout-programming app with a same-origin Hono Worker and Cloudflare D1 database.

## Develop locally

Use Node **24.15.0** (`.node-version`), then:

```sh
npm ci
npm run dev
```

Startup applies migrations and idempotent local seeds. Select a local admin, one of two coaches, or a client persona. Client assignments connect coaches to dedicated client spaces; coaches can also create multiple personal spaces. Exercise libraries are specific to each space. Local databases are isolated from hosted environments and survive ordinary restarts. Schema changes currently assume a full reset; after updating this checkout, run `npm run db:reset:local` to recreate local state.

```sh
npm run check             # types, Worker/deployment/browser tests, hosted build and dry run
npm run db:reset:local    # intentionally reset local data
```

## Hosted workflow

Feature branch → pull request into **dev** → test the dev deployment → pull request from **dev** into **main**.

| Branch | GitHub environment | URL |
| --- | --- | --- |
| dev | dev | https://liftlog-dev.luke-edwards20.workers.dev |
| main | production | https://liftlog-production.luke-edwards20.workers.dev |

Both hosted environments are disposable: **every deployment, including a manual rerun, recreates that environment's database**. The initial state contains Luke's admin account and an owner workspace, with no demo workouts. Main's environment name does not imply durable production data.

Cloudflare Access protects each Worker and permits only `luke.edwards20@gmail.com` through the personal Cloudflare identity provider. No application email service is needed. Local login and fixture endpoints are unavailable remotely.

## Training studio rewrite

The new interface keeps programs → mesocycles → workouts → exercise blocks → strength/cardio sets. It adds a searchable program list, editable exercise variations, clear per-set save feedback, and a mobile navigation drawer. Fonts are served with the app.

Select a local account to start, then use **Switch test user** to test another email and its actual workspace permissions. Local sample workouts are synthetic and seeded with idempotent inserts, so normal restarts preserve your edits.

On hosted **dev**, the same switcher is available only after the allowed owner completes real Cloudflare Access sign-in. Dev seeds a test coach and athlete alongside the owner. New provisioned accounts can also be selected, including invited accounts without activating or linking a real provider. Expiring, opaque, HTTP-only sessions are stored as hashes in D1 and bound to the real authenticated account. Production disables the wrapper independently of configuration flags. See [test identity details](docs/test-identities.md).

Screenshots are in [docs/screenshots](docs/screenshots). To refresh them with the default local sample data and a running server: `node scripts/capture-redesign.mjs`.

See [development](docs/development.md), [deployment and recovery](docs/deployment.md), and [using LiftLog](docs/using-liftlog.md).
