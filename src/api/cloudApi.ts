import { apiRequest, jsonBody } from './http';
import type { CardioSet, Exercise, ExerciseGroup, ExerciseVariation, Mesocycle, Program, StrengthSet, Workout, WorkoutDetail } from '../types/cloud';

const workspace = (id: string) => `/workspaces/${id}`;
const program = (workspaceId: string, id: string) => `${workspace(workspaceId)}/programs/${id}`;

export interface CopyOptions { includeExecutedValues: boolean }
export interface MesocycleSummary {
  strength: { set_count: number; planned_reps: number; actual_reps: number; planned_volume: number; actual_volume: number };
  cardio: { set_count: number; planned_duration_seconds: number; actual_duration_seconds: number; distances: Array<{ distance_unit: string; planned_distance: number; actual_distance: number }> };
}

export const programsApi = {
  list(workspaceId: string, visibility = 'current', ownerUserId?: string) { const q = new URLSearchParams({ visibility }); if (ownerUserId) q.set('ownerUserId', ownerUserId); return apiRequest<Program[]>(`${workspace(workspaceId)}/programs?${q}`); },
  get(workspaceId: string, id: string) { return apiRequest<Program>(program(workspaceId, id)); },
  create(workspaceId: string, input: { name: string; notes?: string; ownerUserId?: string }) { return apiRequest<Program>(`${workspace(workspaceId)}/programs`, { method: 'POST', ...jsonBody(input) }); },
  copy(workspaceId: string, id: string, input: { name: string; targetOwnerUserId: string; targetWorkspaceId?: string } & CopyOptions) { return apiRequest<Program>(`${program(workspaceId, id)}/copy`, { method: 'POST', ...jsonBody(input) }); },
  update(workspaceId: string, row: Program, input: { name: string; notes?: string }) { return apiRequest<Program>(program(workspaceId, row.id), { method: 'PATCH', ...jsonBody({ ...input, revision: row.revision }) }); },
  remove(workspaceId: string, id: string) { return apiRequest<{ deleted: boolean }>(program(workspaceId, id), { method: 'DELETE' }); },
  archive(workspaceId: string, id: string) { return apiRequest<Program>(`${program(workspaceId, id)}/archive`, { method: 'POST' }); },
  restore(workspaceId: string, id: string) { return apiRequest<Program>(`${program(workspaceId, id)}/restore`, { method: 'POST' }); },
  mesocycles(workspaceId: string, id: string) { return apiRequest<Mesocycle[]>(`${program(workspaceId, id)}/mesocycles`); },
  createMesocycle(workspaceId: string, id: string, input: { name: string; mesocycleLength: number; startDate: string; notes?: string; sortOrder?: number }) { return apiRequest<Mesocycle>(`${program(workspaceId, id)}/mesocycles`, { method: 'POST', ...jsonBody(input) }); },
  copyMesocycle(workspaceId: string, programId: string, mesocycleId: string, input: { targetProgramId: string; name?: string; startDate?: string } & CopyOptions) { return apiRequest<Mesocycle>(`${program(workspaceId, programId)}/mesocycles/${mesocycleId}/copy`, { method: 'POST', ...jsonBody(input) }); },
  mesocycleSummary(workspaceId: string, programId: string, mesocycleId: string) { return apiRequest<MesocycleSummary>(`${program(workspaceId, programId)}/mesocycles/${mesocycleId}/summary`); },
  workouts(workspaceId: string, programId: string, mesocycleId: string) { return apiRequest<Workout[]>(`${program(workspaceId, programId)}/mesocycles/${mesocycleId}/workouts`); },
  createWorkout(workspaceId: string, programId: string, mesocycleId: string, input: { name: string; dayOffset: number; notes?: string; sortOrder?: number }) { return apiRequest<Workout>(`${program(workspaceId, programId)}/mesocycles/${mesocycleId}/workouts`, { method: 'POST', ...jsonBody(input) }); },
  generateWorkouts(workspaceId: string, programId: string, mesocycleId: string, workouts: Array<{ name: string; dayOffset: number; notes?: string }>) { return apiRequest<Workout[]>(`${program(workspaceId, programId)}/mesocycles/${mesocycleId}/generate`, { method: 'POST', ...jsonBody({ workouts }) }); },
  workout(workspaceId: string, programId: string, workoutId: string) { return apiRequest<WorkoutDetail>(`${program(workspaceId, programId)}/workouts/${workoutId}`); },
  copyWorkout(workspaceId: string, programId: string, workoutId: string, input: { targetProgramId: string; targetMesocycleId: string; name?: string; dayOffset?: number } & CopyOptions) { return apiRequest<Workout>(`${program(workspaceId, programId)}/workouts/${workoutId}/copy`, { method: 'POST', ...jsonBody(input) }); },
  addExercise(workspaceId: string, programId: string, workoutId: string, input: { exerciseId: string; exerciseVariationId?: string | null; exerciseOrder: number }) { return apiRequest(`${program(workspaceId, programId)}/workouts/${workoutId}/exercises`, { method: 'POST', ...jsonBody(input) }); },
  removeExercise(workspaceId: string, programId: string, blockId: string) { return apiRequest(`${program(workspaceId, programId)}/workout-exercises/${blockId}`, { method: 'DELETE' }); },
  addStrengthSet(workspaceId: string, programId: string, blockId: string, input: Record<string, unknown>) { return apiRequest<StrengthSet>(`${program(workspaceId, programId)}/workout-exercises/${blockId}/strength-sets`, { method: 'POST', ...jsonBody(input) }); },
  addCardioSet(workspaceId: string, programId: string, blockId: string, input: Record<string, unknown>) { return apiRequest<CardioSet>(`${program(workspaceId, programId)}/workout-exercises/${blockId}/cardio-sets`, { method: 'POST', ...jsonBody(input) }); },
  updateStrengthPlan(workspaceId: string, programId: string, setId: string, input: Record<string, unknown>) { return apiRequest<StrengthSet>(`${program(workspaceId, programId)}/strength-sets/${setId}/plan`, { method: 'PATCH', ...jsonBody(input) }); },
  updateStrengthExecution(workspaceId: string, programId: string, setId: string, input: Record<string, unknown>) { return apiRequest<StrengthSet>(`${program(workspaceId, programId)}/strength-sets/${setId}/execution`, { method: 'PATCH', ...jsonBody(input) }); },
  updateCardioPlan(workspaceId: string, programId: string, setId: string, input: Record<string, unknown>) { return apiRequest<CardioSet>(`${program(workspaceId, programId)}/cardio-sets/${setId}/plan`, { method: 'PATCH', ...jsonBody(input) }); },
  updateCardioExecution(workspaceId: string, programId: string, setId: string, input: Record<string, unknown>) { return apiRequest<CardioSet>(`${program(workspaceId, programId)}/cardio-sets/${setId}/execution`, { method: 'PATCH', ...jsonBody(input) }); },
  summary(workspaceId: string, id: string) { return apiRequest<Record<string, number>>(`${program(workspaceId, id)}/summary`); },
};

export const libraryApi = {
  testConfig() { return apiRequest<{ testExercisesEnabled: boolean }>('/session/config'); },
  addTestExercises(workspaceId: string) { return apiRequest<{ exercisesAdded: number }>(`${workspace(workspaceId)}/test-exercises`, { method: 'POST' }); },
  groups(workspaceId: string) { return apiRequest<ExerciseGroup[]>(`${workspace(workspaceId)}/exercise-groups`); },
  createGroup(workspaceId: string, input: { name: string; notes?: string }) { return apiRequest<ExerciseGroup>(`${workspace(workspaceId)}/exercise-groups`, { method: 'POST', ...jsonBody(input) }); },
  exercises(workspaceId: string, search = '') { return apiRequest<Exercise[]>(`${workspace(workspaceId)}/exercises${search ? `?search=${encodeURIComponent(search)}` : ''}`); },
  createExercise(workspaceId: string, input: { exerciseGroupId: string; name: string; exerciseType: 'strength' | 'cardio'; notes?: string }) { return apiRequest<Exercise>(`${workspace(workspaceId)}/exercises`, { method: 'POST', ...jsonBody(input) }); },
  updateExercise(workspaceId: string, row: Exercise, input: { exerciseGroupId: string; name: string; exerciseType: 'strength' | 'cardio'; notes?: string }) { return apiRequest<Exercise>(`${workspace(workspaceId)}/exercises/${row.id}`, { method: 'PATCH', ...jsonBody({ ...input, version: row.version }) }); },
  removeExercise(workspaceId: string, id: string) { return apiRequest(`${workspace(workspaceId)}/exercises/${id}`, { method: 'DELETE' }); },
  variations(workspaceId: string, id: string) { return apiRequest<ExerciseVariation[]>(`${workspace(workspaceId)}/exercises/${id}/variations`); },
  createVariation(workspaceId: string, id: string, input: { name: string; isPrimary: boolean; notes?: string }) { return apiRequest<ExerciseVariation>(`${workspace(workspaceId)}/exercises/${id}/variations`, { method: 'POST', ...jsonBody(input) }); },
};

export interface AdminUser { id: string; email_display: string; display_name: string; status: 'invited' | 'active' | 'disabled'; platform_roles: string | null; workspace_count: number }
export interface WorkspaceMember { workspace_id: string; user_id: string; role: 'owner' | 'coach' | 'client'; status: 'active' | 'suspended'; display_name: string; email_display: string; user_status: string }
export interface WorkspaceRow { kind: 'organization' | 'personal' | 'client'; client_user_id: string | null; personal_owner_user_id: string | null; parent_workspace_id: string | null; id: string; name: string; status: string; history_retention_days: number; member_role: WorkspaceMember['role'] | null; member_status: WorkspaceMember['status'] | null }
export const adminApi = {
  workspaces() { return apiRequest<WorkspaceRow[]>('/workspaces'); },
  createWorkspace(name: string, kind: 'personal' | 'organization' = 'personal') { return apiRequest<WorkspaceRow>('/workspaces', { method: 'POST', ...jsonBody({ name, kind }) }); },
  deleteWorkspace(id: string, confirmName: string) { return apiRequest<{ deleted: boolean }>(`/workspaces/${id}`, { method: 'DELETE', ...jsonBody({ confirmName }) }); },
  users() { return apiRequest<AdminUser[]>('/admin/users'); },
  createUser(input: { email: string; displayName: string; status: AdminUser['status']; workspaceId?: string; role?: WorkspaceMember['role'] }) { return apiRequest<AdminUser>('/admin/users', { method: 'POST', ...jsonBody(input) }); },
  updateUser(id: string, input: { displayName?: string; status?: AdminUser['status'] }) { return apiRequest<AdminUser>(`/admin/users/${id}`, { method: 'PATCH', ...jsonBody(input) }); },
  members(workspaceId: string) { return apiRequest<WorkspaceMember[]>(`${workspace(workspaceId)}/members`); },
  addMember(workspaceId: string, userId: string, role: WorkspaceMember['role']) { return apiRequest(`${workspace(workspaceId)}/members`, { method: 'POST', ...jsonBody({ userId, role }) }); },
  updateMember(workspaceId: string, userId: string, input: { role?: WorkspaceMember['role']; status?: WorkspaceMember['status'] }) { return apiRequest(`${workspace(workspaceId)}/members/${userId}`, { method: 'PATCH', ...jsonBody(input) }); },
  removeMember(workspaceId: string, userId: string) { return apiRequest(`${workspace(workspaceId)}/members/${userId}`, { method: 'DELETE' }); },
};

export interface ClientAssignment {
  client_user_id: string; display_name: string; email_display: string;
  space_id: string; space_name: string; organization_id: string; organization_name: string;
  relationship_id: string | null; coach_user_id: string | null; coach_name: string | null;
  program_count: number; can_force_release: number; can_open: number;
}
export const clientsApi = {
  list() { return apiRequest<ClientAssignment[]>('/clients'); },
  claim(clientUserId: string, coachUserId?: string) { return apiRequest(`/clients/${clientUserId}/claim`, { method: 'POST', ...jsonBody({ coachUserId }) }); },
  release(clientUserId: string, relationshipId: string) { return apiRequest(`/clients/${clientUserId}/release`, { method: 'POST', ...jsonBody({ relationshipId }) }); },
};
