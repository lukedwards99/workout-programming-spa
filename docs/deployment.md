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
- `CLOUDFLARE_ACCESS_OTP_IDP_ID`: UUID of the approved One-time PIN identity provider in this account
- `LANE_RESET_APPROVED`: `<account ID>:dev` or `<account ID>:main`

The deployment credential uses Workers Editor, D1 Write, Access Apps Write, Access Policies Write, and Account Settings Read in this account. Do not grant billing, email, R2, queue, or other-account permissions. The account-owned `LiftLog GitHub Actions` token expires October 1, 2027; rotate it in both environment secrets before expiration. Keep credentials in GitHub environment secrets; never commit or log them.

Hosted login uses only the personal organization's approved One-time PIN identity provider, selected by `CLOUDFLARE_ACCESS_OTP_IDP_ID`, with six-hour application sessions. Deployment validates the provider UUID before any remote operation. CI only attaches the configured provider to the selected LiftLog application; it never creates or changes identity providers. The bootstrap policy permits only `luke.edwards20@gmail.com`, and subsequent deployments preserve the existing explicit beta email allowlist, which must retain the owner. Domain-wide, wildcard, Everyone, and non-email rules are rejected.

Workers Editor can deploy existing Workers but cannot create or delete them. Initial setup creates both Workers in maintenance mode using the operator's personal Cloudflare login and `laneConfig(branch, undefined, { maintenance: true })`. These stable Workers carry the repository/lane ownership variables before CI takes over. Recreating a deleted Worker requires this same operator bootstrap; do not broaden the CI credential to Workers Admin just for routine deployments.

The `verify` check runs `npm run check` on PRs. `promotion policy` runs trusted base-branch code, allows feature PRs into dev, and accepts main PRs only from the same repository's dev branch after its latest deployment for the exact head commit succeeds. PR policy requires merge commits, no mandatory second reviewer, and blocks branch deletion/force-push. Keep main as the default branch.

Bootstrap dev first. The initial dev → main PR installs the trusted promotion workflow on main, so inspect its dev deployment and verification checks before merging under the existing rules. Then require both `verify` and `promotion policy` checks on dev and main. Do not require a check before the workflow exists on its trusted base.

## One-time PIN setup

An operator completes this one-time setup before merging the OTP PR into dev:

1. In the personal account above, go to **Zero Trust → Integrations → Identity providers** and confirm whether **One-time PIN** already exists. If it does not, prepare to add it and request approval before saving this authentication change. Keep the existing Cloudflare provider.
2. After approval, add the One-time PIN provider and copy its UUID from its detail/edit URL. Confirm its type is **One-time PIN**. Creating it through the API requires `Access: Organizations, Identity Providers, and Groups Write`; use an operator credential or the dashboard rather than expanding the CI token.
3. Set the GitHub **dev** environment variable `CLOUDFLARE_ACCESS_OTP_IDP_ID` to that UUID. Set the same variable in **production** before promoting dev into main.
4. Merge the PR into dev. Its normal deployment updates only **LiftLog: dev** to use OTP. Test a fresh login and logout before promoting into main; production's current login stays in place until its own deployment.

See [Cloudflare's One-time PIN instructions](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/). PINs expire after ten minutes and are single-use; requesting a new PIN invalidates the previous one. Cloudflare sends codes only to emails allowed by the application's policy, even though its login page presents the same confirmation to everyone.

## Invite beta testers

1. Sign in as the owner and create each friend's exact email in **Admin Users**, with invited or active status and the intended organization role. The app's existing provisioning flow supplies their space access.
2. In Cloudflare Zero Trust, edit **LiftLog: dev allowlist** under **Access controls → Policies**. Add each approved friend as an **Include → Emails** entry alongside the owner. Keep the policy action **Allow**. Request approval before saving new access if an agent performs this step.
3. Share the dev URL yourself. Friends enter the same email, receive a Cloudflare code, and sign in. Their first real login links the verified email to their pre-created app account and activates an invited account. Unknown or disabled app users cannot use the API even if Cloudflare admits their email.

Manage each lane's allowlist separately; deployment preserves its approved email entries. Every deployment still resets that lane's D1 database, including manually provisioned beta accounts and training data. Re-create those app accounts after a deployment before friends test again. To revoke access, remove the email from the lane's Access allowlist and disable the app account; revoke existing Access sessions if immediate sign-out is required.

## Reset and recovery

`Deploy lanes` runs on pushes to dev/main and supports manual dispatch from those branches. Checks finish before remote mutation. Deployments are serialized per branch and are not cancelled mid-reset.

The script verifies account inputs, artifact commit provenance, Worker ownership variables, the D1 ownership marker, and Access application/policy ownership. It deploys a maintenance response without database bindings or cron triggers, establishes Access, recreates only the selected database, applies migrations and the hosted seed, and activates the built Worker. Post-deployment checks verify the owner/workspace seed and unauthenticated Access redirects. Failures after maintenance restore maintenance; a successful rerun completes a fresh reset.

Dev additionally applies `cloudflare/dev-personas.sql` for a simulated coach and athlete, and enables identity switching only for the configured Access owner/administrator. Main has neither the test seed nor the switch flag. This does not broaden Cloudflare Access. See [testing account access](test-identities.md).

D1 ownership is recorded in `_liftlog_deployment_owner`. A database without a valid ownership marker is never deleted automatically. If a network interruption occurs between database creation and marker initialization, inspect the recorded operation and database identity before manually resolving that orphan; do not bypass the collision check or adopt an unrelated database.

To recover a broken release, revert the change through a PR and redeploy. This recreates disposable data. Do not use a Worker-only version rollback after a database recreation: an old version may reference a deleted database ID. Re-run deployment from the appropriate branch instead.

Before retiring legacy hosting, verify real Access login/logout, navigation and database writes on both Workers. Then disable this repository's GitHub Pages site and remove only the old `liftlog-lukedwards99` Cloudflare Pages project. Keep `bde-web-lukedwards99` and Copy Shop untouched.

## Verification

`npm run check` checks generated bindings, TypeScript, real Worker/D1 tests, deployment/promotion tests, local browser flows, the embedded frontend build, and Wrangler's deploy dry run. Hosted smoke checks are part of deployment; real Cloudflare login and cross-environment reset isolation also need verification at initial cutover.
