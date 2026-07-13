import { programsApi } from './programsApi';
import { exerciseGroupsApi } from './exerciseGroupsApi';
import { exercisesApi } from './exercisesApi';
import { exerciseVariationsApi } from './exerciseVariationsApi';
import { mesocyclesApi } from './mesocyclesApi';
import { workoutsApi } from './workoutsApi';
import { workoutSetsApi } from './workoutSetsApi';
import { activateProgram, deactivateProgram } from '../db/databaseService';
import { localToday } from '../utils/dates';
import type { WorkoutSetType } from '../types/domain';

interface SetDef {
  exerciseName: string;
  variationName?: string;
  setType: string;
  reps: number;
  weight: number;
  rir?: number;
}

interface WorkoutDef {
  name: string;
  dayOffset: number;
  sets: SetDef[];
}

interface SampleProgramResult {
  programId: number;
  programName: string;
}

export async function createSampleProgram(): Promise<SampleProgramResult> {
  const program = await programsApi.create({
    name: 'Getting Started',
    notes: 'A sample strength training program to help you explore LiftLog. Edit or delete freely.',
  });

  await activateProgram(program.id);

  try {
    const groups: Record<string, number> = {};
    const exercises: Record<string, number> = {};

    const groupDefs: [string, string[]][] = [
      ['Chest', ['Barbell Bench Press', 'Incline Dumbbell Press', 'Dumbbell Flyes', 'Cable Crossover']],
      ['Back', ['Pull Ups', 'Barbell Row', 'Lat Pulldown', 'Seated Cable Row']],
      ['Shoulders', ['Overhead Press', 'Lateral Raise', 'Rear Delt Fly', 'Face Pulls']],
      ['Arms', ['Barbell Curl', 'Hammer Curl', 'Tricep Pushdown', 'Skullcrusher']],
      ['Legs', ['Barbell Squat', 'Romanian Deadlift', 'Leg Press', 'Calf Raise']],
      ['Core', ['Plank', 'Hanging Leg Raise', 'Ab Wheel Rollout']],
    ];

    for (const [groupName, exNames] of groupDefs) {
      const g = exerciseGroupsApi.create({ name: groupName });
      if (!g) throw new Error(`Failed to create group: ${groupName}`);
      groups[groupName] = g.id;

      for (const exName of exNames) {
        const e = exercisesApi.create({ groupId: g.id, name: exName });
        if (!e) throw new Error(`Failed to create exercise: ${exName}`);
        exercises[exName] = e.id;
      }
    }

    exerciseVariationsApi.create({
      exerciseId: exercises['Barbell Bench Press'],
      name: 'Close Grip',
    });
    exerciseVariationsApi.create({
      exerciseId: exercises['Romanian Deadlift'],
      name: 'Sumo',
    });
    exerciseVariationsApi.create({
      exerciseId: exercises['Barbell Curl'],
      name: 'EZ Bar',
    });

    const startDate = localToday();

    const meso = mesocyclesApi.create({
      name: 'Foundation Block',
      mesocycleLength: 7,
      startDate,
    });
    if (!meso) throw new Error('Failed to create mesocycle');

    const workoutDefs: WorkoutDef[] = [
      {
        name: 'Push Day',
        dayOffset: 0,
        sets: [
          { exerciseName: 'Barbell Bench Press', setType: 'warmup', reps: 10, weight: 45 },
          { exerciseName: 'Barbell Bench Press', setType: 'normal', reps: 8, weight: 135, rir: 2 },
          { exerciseName: 'Barbell Bench Press', setType: 'normal', reps: 8, weight: 155, rir: 1 },
          { exerciseName: 'Barbell Bench Press', variationName: 'Close Grip', setType: 'normal', reps: 10, weight: 115, rir: 2 },
          { exerciseName: 'Incline Dumbbell Press', setType: 'normal', reps: 10, weight: 55 },
          { exerciseName: 'Incline Dumbbell Press', setType: 'normal', reps: 10, weight: 60 },
          { exerciseName: 'Incline Dumbbell Press', setType: 'dropset', reps: 8, weight: 50 },
          { exerciseName: 'Overhead Press', setType: 'normal', reps: 8, weight: 95, rir: 1 },
          { exerciseName: 'Overhead Press', setType: 'normal', reps: 8, weight: 95, rir: 1 },
          { exerciseName: 'Overhead Press', setType: 'normal', reps: 6, weight: 105, rir: 0 },
          { exerciseName: 'Lateral Raise', setType: 'normal', reps: 15, weight: 15 },
          { exerciseName: 'Lateral Raise', setType: 'normal', reps: 15, weight: 15 },
          { exerciseName: 'Lateral Raise', setType: 'normal', reps: 12, weight: 20 },
          { exerciseName: 'Tricep Pushdown', setType: 'normal', reps: 12, weight: 50 },
          { exerciseName: 'Tricep Pushdown', setType: 'normal', reps: 12, weight: 55 },
          { exerciseName: 'Tricep Pushdown', setType: 'failure', reps: 10, weight: 60 },
        ],
      },
      {
        name: 'Pull Day',
        dayOffset: 2,
        sets: [
          { exerciseName: 'Pull Ups', setType: 'warmup', reps: 5, weight: 0 },
          { exerciseName: 'Pull Ups', setType: 'normal', reps: 8, weight: 0, rir: 2 },
          { exerciseName: 'Pull Ups', setType: 'normal', reps: 8, weight: 0, rir: 1 },
          { exerciseName: 'Barbell Row', setType: 'normal', reps: 8, weight: 135, rir: 2 },
          { exerciseName: 'Barbell Row', setType: 'normal', reps: 8, weight: 155, rir: 1 },
          { exerciseName: 'Barbell Row', setType: 'dropset', reps: 10, weight: 135 },
          { exerciseName: 'Lat Pulldown', setType: 'normal', reps: 10, weight: 120 },
          { exerciseName: 'Lat Pulldown', setType: 'normal', reps: 10, weight: 130 },
          { exerciseName: 'Seated Cable Row', setType: 'normal', reps: 12, weight: 100 },
          { exerciseName: 'Seated Cable Row', setType: 'normal', reps: 10, weight: 110 },
          { exerciseName: 'Barbell Curl', setType: 'normal', reps: 10, weight: 60, rir: 2 },
          { exerciseName: 'Barbell Curl', setType: 'normal', reps: 10, weight: 65, rir: 1 },
          { exerciseName: 'Barbell Curl', variationName: 'EZ Bar', setType: 'normal', reps: 12, weight: 50 },
          { exerciseName: 'Hammer Curl', setType: 'normal', reps: 12, weight: 25 },
          { exerciseName: 'Hammer Curl', setType: 'normal', reps: 10, weight: 30 },
          { exerciseName: 'Face Pulls', setType: 'normal', reps: 15, weight: 30 },
          { exerciseName: 'Face Pulls', setType: 'normal', reps: 15, weight: 35 },
        ],
      },
      {
        name: 'Leg Day',
        dayOffset: 4,
        sets: [
          { exerciseName: 'Barbell Squat', setType: 'warmup', reps: 8, weight: 45 },
          { exerciseName: 'Barbell Squat', setType: 'warmup', reps: 5, weight: 135 },
          { exerciseName: 'Barbell Squat', setType: 'normal', reps: 8, weight: 185, rir: 2 },
          { exerciseName: 'Barbell Squat', setType: 'normal', reps: 6, weight: 225, rir: 2 },
          { exerciseName: 'Barbell Squat', setType: 'normal', reps: 5, weight: 245, rir: 0 },
          { exerciseName: 'Romanian Deadlift', setType: 'normal', reps: 8, weight: 185, rir: 2 },
          { exerciseName: 'Romanian Deadlift', setType: 'normal', reps: 8, weight: 205, rir: 1 },
          { exerciseName: 'Romanian Deadlift', setType: 'normal', reps: 6, weight: 225, rir: 0 },
          { exerciseName: 'Leg Press', setType: 'normal', reps: 10, weight: 270 },
          { exerciseName: 'Leg Press', setType: 'normal', reps: 10, weight: 315 },
          { exerciseName: 'Leg Press', setType: 'normal', reps: 8, weight: 360 },
          { exerciseName: 'Calf Raise', setType: 'normal', reps: 15, weight: 135 },
          { exerciseName: 'Calf Raise', setType: 'normal', reps: 15, weight: 155 },
          { exerciseName: 'Calf Raise', setType: 'dropset', reps: 12, weight: 135 },
          { exerciseName: 'Hanging Leg Raise', setType: 'normal', reps: 12, weight: 0 },
          { exerciseName: 'Hanging Leg Raise', setType: 'normal', reps: 12, weight: 0 },
          { exerciseName: 'Plank', setType: 'normal', reps: 1, weight: 0 },
          { exerciseName: 'Plank', setType: 'normal', reps: 1, weight: 0 },
        ],
      },
    ];

    for (const wDef of workoutDefs) {
      const wo = workoutsApi.create({
        mesocycleId: meso.id,
        name: wDef.name,
        dayOffset: wDef.dayOffset,
      });
      if (!wo) throw new Error(`Failed to create workout: ${wDef.name}`);

      let exerciseOrder = 0;
      let currentExName = '';
      let currentBlockKey = '';
      let currentSetNum = 0;

      for (const sDef of wDef.sets) {
        if (sDef.exerciseName !== currentExName) {
          exerciseOrder++;
          currentExName = sDef.exerciseName;
        }

        const blockKey = `${sDef.exerciseName}::${sDef.variationName ?? ''}`;
        if (blockKey !== currentBlockKey) {
          currentBlockKey = blockKey;
          currentSetNum = 1;
        } else {
          currentSetNum++;
        }

        const exId = exercises[currentExName];
        if (!exId) throw new Error(`Exercise not found: ${currentExName}`);

        let varId: number | null = null;
        if (sDef.variationName) {
          const exVars = exerciseVariationsApi.list(exId);
          const v = exVars.find((x) => x.name === sDef.variationName);
          if (v) varId = v.id;
        }

        workoutSetsApi.create({
          workoutId: wo.id,
          exerciseId: exId,
          exerciseVariationId: varId,
          exerciseOrder,
          setNumber: currentSetNum,
          setType: sDef.setType as WorkoutSetType,
          plannedReps: sDef.reps,
          weight: sDef.weight,
          rir: sDef.rir ?? null,
        });
      }
    }

    return { programId: program.id, programName: program.name };
  } finally {
    await deactivateProgram();
  }
}
