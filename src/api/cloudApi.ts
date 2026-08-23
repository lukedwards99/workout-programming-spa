import { apiRequest, jsonBody } from './http';
import type {
  CardioSet, CardioSetResult, Exercise, ExerciseGroup, ExerciseVariation, Mesocycle, Program,
  StrengthSet, StrengthSetResult, Workout, WorkoutDetail,
} from '../types/cloud';

const workspace = (workspaceId: string) => `/workspaces/${workspaceId}`;
const program = (workspaceId: string, programId: string) => `${workspace(workspaceId)}/programs/${programId}`;

export const programsApi = {
  list(workspaceId: string, visibility = 'current') {
    return apiRequest<Program[]>(`${workspace(workspaceId)}/programs?visibility=${visibility}`);
  },
  get(workspaceId: string, programId: string) { return apiRequest<Program>(program(workspaceId, programId)); },
  create(workspaceId: string, input: { name: string; notes?: string; kind: 'personal' | 'template' }) {
    return apiRequest<Program>(`${workspace(workspaceId)}/programs`, { method: 'POST', ...jsonBody(input) });
  },
  copy(workspaceId: string, programId: string, input: { name: string; kind: 'personal' | 'template' }) { return apiRequest<Program>(`${program(workspaceId, programId)}/copy`, { method: 'POST', ...jsonBody(input) }); },
  update(workspaceId: string, row: Program, input: { name: string; notes?: string; status: Program['status'] }) {
    return apiRequest<Program>(program(workspaceId, row.id), { method: 'PATCH', ...jsonBody({ ...input, revision: row.revision }) });
  },
  remove(workspaceId: string, programId: string) { return apiRequest<{ deleted: boolean }>(program(workspaceId, programId), { method: 'DELETE' }); },
  archive(workspaceId: string, programId: string) { return apiRequest<Program>(`${program(workspaceId, programId)}/archive`, { method: 'POST' }); },
  restore(workspaceId: string, programId: string) { return apiRequest<Program>(`${program(workspaceId, programId)}/restore`, { method: 'POST' }); },
  mesocycles(workspaceId: string, programId: string) { return apiRequest<Mesocycle[]>(`${program(workspaceId, programId)}/mesocycles`); },
  createMesocycle(workspaceId: string, programId: string, input: { name: string; mesocycleLength: number; startDate: string; notes?: string; sortOrder?: number }) {
    return apiRequest<Mesocycle>(`${program(workspaceId, programId)}/mesocycles`, { method: 'POST', ...jsonBody(input) });
  },
  workouts(workspaceId: string, programId: string, mesocycleId: string) { return apiRequest<Workout[]>(`${program(workspaceId, programId)}/mesocycles/${mesocycleId}/workouts`); },
  createWorkout(workspaceId: string, programId: string, mesocycleId: string, input: { name: string; dayOffset: number; notes?: string; sortOrder?: number }) {
    return apiRequest<Workout>(`${program(workspaceId, programId)}/mesocycles/${mesocycleId}/workouts`, { method: 'POST', ...jsonBody(input) });
  },
  generateWorkouts(workspaceId: string, programId: string, mesocycleId: string, workouts: Array<{ name: string; dayOffset: number; notes?: string }>) { return apiRequest<Workout[]>(`${program(workspaceId, programId)}/mesocycles/${mesocycleId}/generate`, { method: 'POST', ...jsonBody({ workouts }) }); },
  workout(workspaceId: string, programId: string, workoutId: string) { return apiRequest<WorkoutDetail>(`${program(workspaceId, programId)}/workouts/${workoutId}`); },
  addExercise(workspaceId: string, programId: string, workoutId: string, input: { exerciseId: string; exerciseVariationId?: string | null; exerciseOrder: number }) {
    return apiRequest(`${program(workspaceId, programId)}/workouts/${workoutId}/exercises`, { method: 'POST', ...jsonBody(input) });
  },
  removeExercise(workspaceId: string, programId: string, blockId: string) { return apiRequest(`${program(workspaceId, programId)}/workout-exercises/${blockId}`, { method: 'DELETE' }); },
  addStrengthSet(workspaceId: string, programId: string, blockId: string, input: Record<string, unknown>) {
    return apiRequest<StrengthSet>(`${program(workspaceId, programId)}/workout-exercises/${blockId}/strength-sets`, { method: 'POST', ...jsonBody(input) });
  },
  addCardioSet(workspaceId: string, programId: string, blockId: string, input: Record<string, unknown>) {
    return apiRequest<CardioSet>(`${program(workspaceId, programId)}/workout-exercises/${blockId}/cardio-sets`, { method: 'POST', ...jsonBody(input) });
  },
  updateStrengthSet(workspaceId: string, programId: string, setId: string, input: Record<string, unknown>) {
    return apiRequest<StrengthSet>(`${program(workspaceId, programId)}/strength-sets/${setId}`, { method: 'PATCH', ...jsonBody(input) });
  },
  updateCardioSet(workspaceId: string, programId: string, setId: string, input: Record<string, unknown>) {
    return apiRequest<CardioSet>(`${program(workspaceId, programId)}/cardio-sets/${setId}`, { method: 'PATCH', ...jsonBody(input) });
  },
  summary(workspaceId: string, programId: string) { return apiRequest<Record<string, number>>(`${program(workspaceId, programId)}/summary`); },
};

export const libraryApi = {
  groups(workspaceId: string) { return apiRequest<ExerciseGroup[]>(`${workspace(workspaceId)}/exercise-groups`); },
  createGroup(workspaceId: string, input: { name: string; notes?: string }) { return apiRequest<ExerciseGroup>(`${workspace(workspaceId)}/exercise-groups`, { method: 'POST', ...jsonBody(input) }); },
  exercises(workspaceId: string, search = '') { return apiRequest<Exercise[]>(`${workspace(workspaceId)}/exercises${search ? `?search=${encodeURIComponent(search)}` : ''}`); },
  createExercise(workspaceId: string, input: { exerciseGroupId: string; name: string; exerciseType: 'strength' | 'cardio'; notes?: string }) { return apiRequest<Exercise>(`${workspace(workspaceId)}/exercises`, { method: 'POST', ...jsonBody(input) }); },
  updateExercise(workspaceId: string, row: Exercise, input: { exerciseGroupId: string; name: string; exerciseType: 'strength' | 'cardio'; notes?: string }) { return apiRequest<Exercise>(`${workspace(workspaceId)}/exercises/${row.id}`, { method: 'PATCH', ...jsonBody({ ...input, version: row.version }) }); },
  removeExercise(workspaceId: string, exerciseId: string) { return apiRequest(`${workspace(workspaceId)}/exercises/${exerciseId}`, { method: 'DELETE' }); },
  variations(workspaceId: string, exerciseId: string) { return apiRequest<ExerciseVariation[]>(`${workspace(workspaceId)}/exercises/${exerciseId}/variations`); },
  createVariation(workspaceId: string, exerciseId: string, input: { name: string; isPrimary: boolean; notes?: string }) { return apiRequest<ExerciseVariation>(`${workspace(workspaceId)}/exercises/${exerciseId}/variations`, { method: 'POST', ...jsonBody(input) }); },
};

export interface AdminUser { id: string; email_display: string; display_name: string; status: 'invited' | 'active' | 'disabled'; platform_roles: string | null; workspace_count: number; }
export interface WorkspaceMember { workspace_id: string; user_id: string; role: 'owner' | 'coach' | 'client'; status: 'active' | 'suspended'; display_name: string; email_display: string; user_status: string; }
export interface AdminWorkspace { id: string; name: string; status: string; history_retention_days: number; legal_hold_at: string | null; legal_hold_reason: string | null; legal_hold_by_user_id: string | null; }
export const adminApi = {
  users() { return apiRequest<AdminUser[]>('/admin/users'); },
  createUser(input: { email: string; displayName: string; status: AdminUser['status']; workspaceId?: string; role?: WorkspaceMember['role'] }) { return apiRequest<AdminUser>('/admin/users', { method: 'POST', ...jsonBody(input) }); },
  updateUser(userId: string, input: { displayName?: string; status?: AdminUser['status'] }) { return apiRequest<AdminUser>(`/admin/users/${userId}`, { method: 'PATCH', ...jsonBody(input) }); },
  members(workspaceId: string) { return apiRequest<WorkspaceMember[]>(`${workspace(workspaceId)}/members`); },
  updateMember(workspaceId: string, userId: string, input: { role?: WorkspaceMember['role']; status?: WorkspaceMember['status'] }) { return apiRequest(`${workspace(workspaceId)}/members/${userId}`, { method: 'PATCH', ...jsonBody(input) }); },
  removeMember(workspaceId: string, userId: string) { return apiRequest(`${workspace(workspaceId)}/members/${userId}`, { method: 'DELETE' }); },
  workspace(workspaceId: string) { return apiRequest<AdminWorkspace>(`/admin/workspaces/${workspaceId}`); },
  setLegalHold(workspaceId: string, enabled: boolean, reason?: string) { return apiRequest<AdminWorkspace>(`/admin/workspaces/${workspaceId}/legal-hold`, { method: 'PATCH', ...jsonBody({ enabled, reason }) }); },
};

export interface ClientRelationship { id: string; client_user_id: string; coach_user_id: string; status: string; display_name: string; email_display: string; membership_status: string; active_assignments: number; }
export interface Assignment { id: string; source_program_id: string; assigned_program_id: string; client_user_id: string; coach_user_id: string; source_revision: number; status: 'active' | 'completed'; source_program_name: string; assigned_program_name: string; client_name: string; coach_name: string; starts_on: string | null; ends_on: string | null; }
export const assignmentsApi = {
  clients(workspaceId: string) { return apiRequest<ClientRelationship[]>(`${workspace(workspaceId)}/clients`); },
  assignments(workspaceId: string) { return apiRequest<Assignment[]>(`${workspace(workspaceId)}/assignments`); },
  create(workspaceId: string, input: { sourceProgramId: string; clientUserId: string; name?: string; startsOn?: string; endsOn?: string }) { return apiRequest<Assignment>(`${workspace(workspaceId)}/assignments`, { method: 'POST', ...jsonBody(input) }); },
  update(workspaceId: string, assignmentId: string, input: { status: Assignment['status']; startsOn?: string | null; endsOn?: string | null }) { return apiRequest<Assignment>(`${workspace(workspaceId)}/assignments/${assignmentId}`, { method: 'PATCH', ...jsonBody(input) }); },
  remove(workspaceId: string, assignmentId: string) { return apiRequest(`${workspace(workspaceId)}/assignments/${assignmentId}`, { method: 'DELETE' }); },
  addClient(workspaceId: string, clientUserId: string, coachUserId?: string) { return apiRequest<ClientRelationship>(`${workspace(workspaceId)}/clients`, { method: 'POST', ...jsonBody({ clientUserId, coachUserId }) }); },
  removeClientRelationship(workspaceId: string, relationshipId: string) { return apiRequest(`${workspace(workspaceId)}/clients/${relationshipId}`, { method: 'DELETE' }); },
};

export interface WorkoutSession { id: string; workout_id: string; athlete_user_id: string; status: 'in_progress' | 'completed' | 'skipped'; version: number; athlete_notes: string | null; workout_name?: string; athlete_name?: string; }
export interface WorkoutSessionDetail extends WorkoutSession { strength_results: StrengthSetResult[]; cardio_results: CardioSetResult[]; }
export const trainingApi = {
  list(workspaceId: string, programId: string) { return apiRequest<WorkoutSession[]>(`${program(workspaceId, programId)}/sessions`); },
  start(workspaceId: string, programId: string, workoutId: string) { return apiRequest<WorkoutSession>(`${program(workspaceId, programId)}/workouts/${workoutId}/sessions`, { method: 'POST', ...jsonBody({}) }); },
  get(workspaceId: string, programId: string, sessionId: string) { return apiRequest<WorkoutSessionDetail>(`${program(workspaceId, programId)}/sessions/${sessionId}`); },
  finish(workspaceId: string, programId: string, row: WorkoutSession, status: WorkoutSession['status'], athleteNotes?: string) { return apiRequest<WorkoutSession>(`${program(workspaceId, programId)}/sessions/${row.id}`, { method: 'PATCH', ...jsonBody({ status, athleteNotes, version: row.version }) }); },
  strengthResult(workspaceId: string, programId: string, sessionId: string, input: Record<string, unknown>) { return apiRequest<StrengthSetResult>(`${program(workspaceId, programId)}/sessions/${sessionId}/strength-results`, { method: 'PUT', ...jsonBody(input) }); },
  cardioResult(workspaceId: string, programId: string, sessionId: string, input: Record<string, unknown>) { return apiRequest<CardioSetResult>(`${program(workspaceId, programId)}/sessions/${sessionId}/cardio-results`, { method: 'PUT', ...jsonBody(input) }); },
};
