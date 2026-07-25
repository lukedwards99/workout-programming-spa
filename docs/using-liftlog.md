# Using LiftLog

LiftLog helps you design a training plan in the browser. It is a planning tool: summaries are calculated from the program you enter, rather than from completed sessions.

## Core concepts

- **Program**: the top-level container for a training plan. Each program has its own mesocycles, workouts, and exercise library.
- **Mesocycle**: a dated training block with a length in days. A mesocycle contains workouts assigned to individual days.
- **Workout**: one scheduled training session within a mesocycle. A day can contain more than one workout.
- **Exercise library**: the program-specific list of exercise groups and exercises available when building workouts.
- **Variation**: an optional named form of an exercise, such as a grip or equipment variation. An exercise can appear separately in a workout with different variations, but the same exercise-and-variation combination cannot be added twice to one workout.
- **Set**: the planning unit inside an exercise block. A set can include its type, planned reps, actual reps, weight, RIR, and notes.

## Create your first program

1. On the **Programs** page, select **New Program** and give it a name. Notes are optional.
2. Open the program and create a mesocycle. Set its name, start date, and length in days.
3. Open the **Exercises** tab to add exercise groups, exercises, and optional variations. You can also use **Data → Seed Default Exercises** to begin with the included starter library.
4. Return to the **Mesocycles** tab and open the mesocycle. Add workouts to the appropriate days.
5. Open each workout, choose **Add Exercise**, then add or reorder exercises and sets.
6. Use the program, mesocycle, or workout summary to review the resulting plan.

The in-app **Tutorial** can also create a populated sample program for exploration.

## Build a workout

Choose **Add Exercise**, select its group and exercise, and optionally choose a variation. A new exercise begins with one normal set. From the exercise block, you can:

- add or remove sets;
- choose a set type: `warmup`, `normal`, `dropset`, `failure`, or `rest-pause`;
- enter planned and actual reps independently, plus weight, RIR, and notes;
- move sets or exercise blocks to adjust their order; and
- remove the exercise block from that workout.

Use **planned reps** for the prescription you intend to perform and **actual reps** for the outcome you record. They are stored independently.

## Reuse workout templates

On a mesocycle schedule, use a workout's edit control to rename it, move it to another day, or create a deep copy. A copied workout includes its exercise blocks and set details.

Use **Generate Workouts** when a set of existing workouts should repeat through the mesocycle:

1. Select one or more sample workouts.
2. Set the repeat interval in days and the total occurrences, including the original sample.
3. Review the preview, then generate the copies.

The generator preserves the selected workouts' relative day spacing. Existing workouts on destination days remain in place, and requested copies outside the mesocycle are omitted from the result.

## Read summaries

Program, mesocycle, and workout summaries show programmed workouts, exercises, variations, sets, reps, volume, and average RIR. The program and mesocycle views also provide breakdowns by exercise group and exercise.

Use the set-type filter to choose which set types are included. Warm-up sets are counted separately from working sets; non-warm-up types count as working sets. Actual reps and volume are shown in breakdowns, but changing actual reps does not change the programmed summary metrics.

For Excel-based editing, see [Mesocycle spreadsheets](mesocycle-spreadsheets.md). For backups and moving exercise libraries, see [Data management and backups](data-management.md).
