# Cloudflare deployments

## Ownership and resources

All operations are pinned to personal account `ddb45a91c623b716978d580d88298be1` and Workers subdomain `luke-edwards20`. Copy Shop is a read-only architectural reference; its credentials, resources, and repository settings are never deployment inputs.

Each branch owns exactly one Worker, D1 database, Access application, and allowlist policy:

| Branch | Worker / database | Access application |
| --- | --- | --- |
| dev | liftlog-dev | LiftLog: dev |
| main | liftlog-production | LiftLog: main |

The Worker serves embedded frontend files and the API directly. It intentionally has no Static Assets binding: the Cloudflare static-assets router does not propagate `ctx.access` into application code. Preview URLs are disabled. The Worker checks Access before serving any frontend/API response, and API authorization resolves the runtime's verified email into a pre-created active user. Request email headers and local cookies are never hosted identities.

## GitHub setup

Create environments `dev` (branch `dev` only) and `production` (branch `main` only), with no reviewer gate. Each needs the secret `CLOUDFLARE_API_TOKEN`, scoped to the personal account, and these variables:

- `CLOUDFLARE_ACCOUNT_ID`: `ddb45a91c623b716978d580d88298be1`
- `CLOUDFLARE_WORKERS_SUBDOMAIN`: `luke-edwards20`
- `CLOUDFLARE_ACCESS_ALLOWED_EMAIL`: `luke.edwards20@gmail.com`
- `LANE_RESET_APPROVED`: `<account ID>:dev` or `<account ID>:main`

The deployment credential uses Workers Editor, D1 Write, Access Apps Write, Access Policies Write, and Account Settings Read in this account. Do not grant billing, email, R2, queue, or other-account permissions. The account-owned `LiftLog GitHub Actions` token expires October 1, 2027; rotate it in both environment secrets before expiration. Keep credentials in GitHub environment secrets; never commit or log them.

Hosted login uses the personal organization's existing Cloudflare account identity provider, pinned by ID in `scripts/cloudflare/config.mjs`, with six-hour application sessions. Only `luke.edwards20@gmail.com` is allowed. No email-code provider is added, and other applications' identity settings remain unchanged.

Workers Editor can deploy existing Workers but cannot create or delete them. Initial setup creates both Workers in maintenance mode using the operator's personal Cloudflare login and `laneConfig(branch, undefined, { maintenance: true })`. These stable Workers carry the repository/lane ownership variables before CI takes over. Recreating a deleted Worker requires this same operator bootstrap; do not broaden the CI credential to Workers Admin just for routine deployments.

The `verify` check runs `npm run check` on PRs. `promotion policy` runs trusted base-branch code, allows feature PRs into dev, and accepts main PRs only from the same repository's dev branch after its latest deployment for the exact head commit succeeds. PR policy requires merge commits, no mandatory second reviewer, and blocks branch deletion/force-push. Keep main as the default branch.

Bootstrap dev first. The initial dev → main PR installs the trusted promotion workflow on main, so inspect its dev deployment and verification checks before merging under the existing rules. Then require both `verify` and `promotion policy` checks on dev and main. Do not require a check before the workflow exists on its trusted base.

## Reset and recovery

`Deploy lanes` runs on pushes to dev/main and supports manual dispatch from those branches. Checks finish before remote mutation. Deployments are serialized per branch and are not cancelled mid-reset.

The script verifies account inputs, artifact commit provenance, Worker ownership variables, the D1 ownership marker, and Access application/policy ownership. It deploys a maintenance response without database bindings or cron triggers, establishes Access, recreates only the selected database, applies migrations and the hosted seed, and activates the built Worker. Post-deployment checks verify the owner/workspace seed and unauthenticated Access redirects. Failures after maintenance restore maintenance; a successful rerun completes a fresh reset.

Dev additionally applies `cloudflare/dev-personas.sql` for a simulated coach and athlete, and enables identity switching only for the configured Access owner/administrator. Main has neither the test seed nor the switch flag. This does not broaden Cloudflare Access. See [testing account access](test-identities.md).

D1 ownership is recorded in `_liftlog_deployment_owner`. A database without a valid ownership marker is never deleted automatically. If a network interruption occurs between database creation and marker initialization, inspect the recorded operation and database identity before manually resolving that orphan; do not bypass the collision check or adopt an unrelated database.

To recover a broken release, revert the change through a PR and redeploy. This recreates disposable data. Do not use a Worker-only version rollback after a database recreation: an old version may reference a deleted database ID. Re-run deployment from the appropriate branch instead.

Before retiring legacy hosting, verify real Access login/logout, navigation and database writes on both Workers. Then disable this repository's GitHub Pages site and remove only the old `liftlog-lukedwards99` Cloudflare Pages project. Keep `bde-web-lukedwards99` and Copy Shop untouched.

## Verification

`npm run check` checks generated bindings, TypeScript, real Worker/D1 tests, deployment/promotion tests, local browser flows, the embedded frontend build, and Wrangler's deploy dry run. Hosted smoke checks are part of deployment; real Cloudflare login and cross-environment reset isolation also need verification at initial cutover.
