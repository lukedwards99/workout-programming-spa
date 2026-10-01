export type EntityId = string;

export interface WorkspaceMembership {
  workspaceId: string;
  workspaceName: string;
  role: 'owner' | 'coach' | 'client';
  status: 'active' | 'suspended';
}

export interface AuthPrincipal {
  testing?: { canSwitch: boolean; authenticatedEmail: string; isImpersonating: boolean };
  userId: string;
  displayName: string;
  verifiedEmail: string;
  provider: string;
  providerSubject: string;
  platformRoles: string[];
  memberships: WorkspaceMembership[];
  availableWorkspaces: Array<{
    workspaceId: string;
    workspaceName: string;
    role: 'admin' | 'owner' | 'coach' | 'client';
    status: 'active' | 'suspended';
    isMember: boolean;
  }>;
}

export interface LocalUser {
  roles?: string;
  id: string;
  display_name: string;
  email_display: string;
  status: string;
}

export interface Program {
  mesocycle_count?: number;
  workout_count?: number;
  id: string;
  workspace_id: string;
  owner_user_id: string;
  owner_name?: string;
  name: string;
  notes: string | null;
  visibility: 'current' | 'archived';
  revision: number;
  created_at: string;
  updated_at: string;
  updated_by_user_id: string | null;
}

export interface Mesocycle {
  id: string;
  workspace_id: string;
  program_id: string;
  name: string;
  mesocycle_length: number;
  start_date: string;
  notes: string | null;
  sort_order: number;
  version: number;
  workout_count?: number;
}

export interface Workout {
  id: string;
  workspace_id: string;
  program_id: string;
  mesocycle_id: string;
  name: string;
  day_offset: number;
  notes: string | null;
  sort_order: number;
  version: number;
}

export interface ExerciseGroup {
  id: string;
  workspace_id: string;
  name: string;
  notes: string | null;
  exercise_count?: number;
}

export interface Exercise {
  id: string;
  workspace_id: string;
  exercise_group_id: string;
  group_name?: string;
  name: string;
  exercise_type: 'strength' | 'cardio';
  tutorial_url: string | null;
  notes: string | null;
  version: number;
  usage_count?: number;
}

export interface ExerciseVariation {
  id: string;
  workspace_id: string;
  exercise_id: string;
  name: string;
  is_primary: number;
  tutorial_url: string | null;
  notes: string | null;
  version: number;
}

export interface StrengthSet {
  id: string;
  set_number: number;
  set_type: 'warmup' | 'normal' | 'dropset' | 'failure' | 'rest-pause';
  planned_reps: number | null;
  actual_reps: number | null;
  planned_weight: number | null;
  actual_weight: number | null;
  target_rir: number | null;
  actual_rir: number | null;
  coach_notes: string | null;
  athlete_notes: string | null;
  version: number;
}

export interface CardioSet {
  id: string;
  set_number: number;
  planned_duration_seconds: number | null;
  actual_duration_seconds: number | null;
  planned_distance: number | null;
  actual_distance: number | null;
  distance_unit: 'mi' | 'km' | 'm' | null;
  target_rpe: number | null;
  actual_rpe: number | null;
  coach_notes: string | null;
  athlete_notes: string | null;
  version: number;
}

export interface WorkoutExerciseBlock {
  id: string;
  exercise_name: string;
  exercise_notes: string | null;
  exercise_type: 'strength' | 'cardio';
  variation_name: string | null;
  group_name: string;
  exercise_order: number;
  version: number;
  sets: Array<StrengthSet | CardioSet>;
}

export interface WorkoutDetail extends Workout {
  exercise_blocks: WorkoutExerciseBlock[];
}
