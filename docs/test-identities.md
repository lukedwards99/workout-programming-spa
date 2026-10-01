# Testing account access

Local preview: http://127.0.0.1:5173. Start with `npm run dev` if the server is no longer running.

## Local accounts

| Email | Role | Try this |
| --- | --- | --- |
| admin@liftlog.local | Platform admin + workspace owner | Build a program, edit plans/results, provision accounts, manage workspaces |
| coach@liftlog.local | Coach | Edit your own or linked client plans; copy programs to the client |
| client@liftlog.local | Client | Open Build & balance; record actual values; check that plan inputs are disabled |

Sample programs, dates, and set values are synthetic. They exist only in local state. Startup uses idempotent inserts and preserves user edits. E2E tests use a separate database and isolated fixture workspaces.

Use **Switch test user** in the account strip to select another email without signing out. The strip shows the effective email; the picker also shows the real authenticated email. **Return to my account** exits the wrapper. Account changes remount page state, return to Programs, and notify other open tabs.

To test another email, provision a user in Admin Users and choose its workspace role. It becomes selectable in the switcher, including while invited. Simulation leaves the invitation state and real authentication identities unchanged.

## Hosted dev and production

Cloudflare Access still requires Luke's real identity. The dev lane sets `DEV_IDENTITY_SWITCH_ENABLED=true` and `DEV_IDENTITY_SWITCH_EMAIL=luke.edwards20@gmail.com`. A fresh dev deployment creates `coach@liftlog.test` and `athlete@liftlog.test` in the owner's workspace. They are synthetic identities, not additional Cloudflare Access allowlist entries. Hosted dev starts with no workout data.

The owner can select those accounts or provision more. All protected API calls resolve the real Access principal first, verify the environment/allowlisted administrator, then apply a valid test session. Existing workspace, ownership, coach–client, and plan/execution authorization runs against the selected account.

The production lane disables the wrapper and has no test-persona seed. Even accidentally enabling the switch flag or supplying a local/test cookie cannot activate switching in production.

## Temporary session design

- A cryptographically random opaque cookie identifies a six-hour session. Cookies are HTTP-only, same-site Strict, and Secure on hosted dev.
- D1 stores only the SHA-256 token hash, real actor ID, selected subject ID, creation time, and expiry. No new workout tables or ownership relationships are introduced.
- Every request verifies the real account before reading the token. Expired, unknown, deleted, or disabled test subjects fail the request; a write never silently falls back to owner permissions.
- Switching revokes the previous token, expired sessions are pruned when creating a session, and exiting/logging out revokes the current token. Audit events record the real actor and selected subject at the boundary. Subsequent workout history records the effective actor as before.
- Real provider identity linking is unchanged. Test identities do not acquire Cloudflare provider links.
- Existing cross-origin write protection applies to switching endpoints.

Remove this temporary wrapper when testing is complete: disable the dev flag, remove the dev-persona seed step, and retire `/api/test-auth/*` plus the `test_identity_sessions` table in a follow-up migration. Ordinary Access account resolution remains separate in `worker/provider-auth.ts`.

Existing hosted database resets on deployment are unchanged. Review the PR locally before merging to dev.
