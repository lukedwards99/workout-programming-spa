# LiftLog

A React workout-programming app with a same-origin Hono Worker and Cloudflare D1 database.

## Develop locally

Use Node **24.15.0** (`.node-version`), then:

```sh
npm ci
npm run dev
```

Startup applies migrations and idempotent local seeds. Select a local owner, coach, or client persona. Local databases are isolated from hosted environments and survive ordinary restarts.

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

Cloudflare Access protects each Worker and permits only `luke.edwards20@gmail.com`, using an emailed login code. No application email service is needed. Local persona selection and test fixture endpoints are unavailable remotely.

See [development](docs/development.md), [deployment and recovery](docs/deployment.md), and [using LiftLog](docs/using-liftlog.md).
