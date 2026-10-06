import type { WorkspaceMembership } from '../types/cloud';

type SpaceKind = WorkspaceMembership['kind'];
interface GroupableSpace { kind: SpaceKind; personalOwnerUserId: string | null; }

export function groupSpaces<T extends GroupableSpace>(spaces: T[], userId: string) {
  return [
    { key: 'mine', label: 'My spaces', spaces: spaces.filter(space => space.kind === 'personal' && space.personalOwnerUserId === userId) },
    { key: 'clients', label: 'Client spaces', spaces: spaces.filter(space => space.kind === 'client') },
    { key: 'team', label: 'Team', spaces: spaces.filter(space => space.kind === 'organization') },
    { key: 'other', label: 'Other personal spaces', spaces: spaces.filter(space => space.kind === 'personal' && space.personalOwnerUserId !== userId) },
  ];
}

export function spaceAccessLabel(kind: SpaceKind, role: string | null, isPersonalOwner = false) {
  if (kind === 'personal' && isPersonalOwner) return 'Your private space';
  if (role === 'admin') return 'Administrator access';
  if (kind === 'client') {
    if (role === 'owner') return 'Organization owner access';
    if (role === 'coach') return 'Assigned coach access';
    return 'Your training space';
  }
  if (kind === 'organization' && role === 'owner') return 'Organization owner';
  return role === 'coach' ? 'Coach' : 'Space owner';
}
