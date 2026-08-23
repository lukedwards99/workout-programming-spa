import { loadPrincipalForIdentity } from './auth';
import { ApiError, all, first, newId, now } from './lib';
import type { AuthPrincipal } from './types';

export interface ValidatedProviderIdentity {
  provider: string;
  providerSubject: string;
  verifiedEmail: string;
}

export async function resolveValidatedProviderIdentity(
  db: D1Database,
  input: ValidatedProviderIdentity,
): Promise<AuthPrincipal> {
  const provider = input.provider.trim().toLowerCase();
  const providerSubject = input.providerSubject.trim();
  const email = input.verifiedEmail.trim().toLowerCase();
  if (!provider || !providerSubject || !email) throw new ApiError(401, 'invalid_provider_identity', 'The provider identity is incomplete.');

  const existing = await loadPrincipalForIdentity(db, provider, providerSubject);
  if (existing) return existing;

  const candidates = await all<{ id: string }>(db.prepare(
    `SELECT u.id FROM users u
     WHERE u.email_normalized = ? AND u.status IN ('invited', 'active')
       AND NOT EXISTS (SELECT 1 FROM auth_identities ai WHERE ai.user_id = u.id AND ai.provider = ?)`,
  ).bind(email, provider));
  if (candidates.length !== 1) {
    throw new ApiError(401, 'unknown_provider_user', 'This verified identity is not linked to a single pre-created beta account.');
  }

  const userId = candidates[0].id; const timestamp = now();
  const duplicate = await first(db.prepare(
    'SELECT 1 FROM auth_identities WHERE provider = ? AND provider_subject = ?',
  ).bind(provider, providerSubject));
  if (duplicate) throw new ApiError(409, 'provider_identity_conflict', 'That provider identity is already linked.');
  await db.batch([
    db.prepare(`INSERT INTO auth_identities
      (id, user_id, provider, provider_subject, email_at_link, last_seen_at, created_at, updated_at, updated_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(newId(), userId, provider, providerSubject, email, timestamp, timestamp, timestamp, userId),
    db.prepare(`UPDATE users SET status = 'active', updated_at = ?, updated_by_user_id = ? WHERE id = ?`).bind(timestamp, userId, userId),
  ]);
  const principal = await loadPrincipalForIdentity(db, provider, providerSubject);
  if (!principal) throw new ApiError(401, 'provider_link_failed', 'The linked beta account cannot sign in.');
  return principal;
}
