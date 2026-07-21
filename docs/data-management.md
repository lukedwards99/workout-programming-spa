# Data management and backups

LiftLog keeps your data in the current browser on the current device. There is no account or cloud synchronization. Export a backup before clearing browser data, using private/incognito browsing, switching devices, or making a destructive import.

## Exercise-library JSON

The **Data** tab inside a program can export its exercise library as a `.json` file. This export includes exercise groups, exercises, variations, URLs, and notes. It does not include mesocycles, workouts, or workout sets.

To use it in another program:

1. Open the destination program's **Data** tab.
2. Under **Import Exercises into Program**, select the exported `.json` file.
3. Review the confirmation and import it.

Imports merge into the destination library. Existing groups with the same name are reused; an existing exercise in that group is retained and any missing named variations are added. Re-importing the same export does not intentionally duplicate the same exercise or variation.

## Complete program backup

Use **Data → Download Program Backup** to save a complete `.sqlite` backup of the current program. It includes the program metadata, mesocycles, workouts, exercise library, and workout sets.

To restore a backup:

1. Open the target program's **Data** tab.
2. Choose **Restore Program Backup** and select a valid LiftLog `.sqlite` backup.
3. Read the displayed backup information and confirm the replacement.

> **Warning:** restoring replaces every mesocycle, workout, exercise, and set in the target program. It cannot be undone from within LiftLog. Download a fresh backup of the target program first if you may need its current state.

A restore only changes the selected program; other programs remain separate. The restored backup can also restore its original program name and notes, so the restore is rejected if that name is already used by another program.

## Back up to a folder

Where the browser supports folder access, the **Program Backup** section lets you choose a directory and save the current program directly into it.

1. Select **Choose Backup Folder** and grant the browser access when prompted.
2. Select **Back Up to Folder** whenever you want to refresh the backup.
3. If permission is later denied or the browser no longer supports access, select the folder again or use **Download Program Backup**.

LiftLog keeps a stable backup identity for the program, so later folder backups update the same backup file even if the program is renamed. If direct folder access is unavailable, download the `.sqlite` file and save it yourself in a synced or otherwise protected location.

## Recommended routine

- Download a complete program backup before substantial edits, restores, or spreadsheet imports.
- Keep more than one dated copy outside the browser when the plan matters.
- Test a backup only when you have first saved a current backup of the target program.
- Export the exercise library JSON when you want to reuse exercises in another LiftLog program.

See [Mesocycle spreadsheets](mesocycle-spreadsheets.md) for the separate Excel import workflow.
