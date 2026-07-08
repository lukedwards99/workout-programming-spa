import { queryAll, execSQL, lastInsertRowId } from '../db/databaseService';
import { exerciseGroupsApi } from './exerciseGroupsApi';
import { exercisesApi } from './exercisesApi';
import { exerciseVariationsApi } from './exerciseVariationsApi';

export const copyApi = {
  /**
   * Copy exercises from a source program to a target program.
   * Creates groups in the target program if needed (same name = merge).
   * Returns the mapping of old exercise IDs → new exercise IDs.
   */
  copyExercises(sourceProgramId, targetProgramId, exerciseIds) {
    const idMap = {}; // oldId → newId
    const groupMap = {}; // oldGroupId → newGroupId

    for (const exId of exerciseIds) {
      const sourceEx = exercisesApi.get(Number(exId));
      if (!sourceEx) continue;

      const sourceGroup = queryAll('SELECT * FROM exercise_groups WHERE id = ?', [sourceEx.exercise_group_id])[0];
      if (!sourceGroup) continue;

      // Find or create target group (same name = same group)
      if (!groupMap[sourceGroup.id]) {
        groupMap[sourceGroup.id] = exerciseGroupsApi.findOrCreate(targetProgramId, sourceGroup.name).id;
      }
      const targetGroupId = groupMap[sourceGroup.id];

      // Create target exercise
      const newEx = exercisesApi.create({
        groupId: targetGroupId,
        name: sourceEx.name,
        tutorialUrl: sourceEx.tutorial_url,
        notes: sourceEx.notes,
      });
      idMap[sourceEx.id] = newEx.id;

      // Copy variations
      const variations = exerciseVariationsApi.list(sourceEx.id);
      for (const v of variations) {
        exerciseVariationsApi.create({
          exerciseId: newEx.id,
          name: v.name,
          isPrimary: v.is_primary,
          tutorialUrl: v.tutorial_url,
          notes: v.notes,
        });
      }
    }

    return idMap;
  },

  /**
   * Get exercises from a source program for the copy picker UI.
   */
  getSourceExercises(sourceProgramId) {
    const groups = exerciseGroupsApi.list(sourceProgramId);
    return groups.map((g) => {
      const exs = exercisesApi.list(sourceProgramId, g.id);
      return { group: g, exercises: exs };
    });
  },
};
