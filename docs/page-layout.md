# Page Layout Documentation

## Overview Page

Route: `/`

Displays a summary of all mesocycles. Each mesocycle is represented as a card showing its name, date range, and other key information. Users can click on a mesocycle card to view its main page.

## Mesocycle Page

Route: `/mesocycle/:id`

Displays detailed information about a specific mesocycle, including its name, date range, and a list of its microcycles. Each microcyle is represented as a row on a table. Each column of that row will show one of the workouts for that microcycle. Users can click on a microcycle details button to view the microcycle details page, a summary button to view the microcycle summary page, or click on a workout to view the main workout page.

## Mesocycle Details Page

Route: `/mesocycle/:id/details`

Displays miscellaneous details about the mesocycle, such as notes, goals, and any other relevant information that doesn't fit into the main mesocycle page.

## Mesocycle Summary Page

Route: `/mesocycle/:id/summary`

Displays a summary of the mesocycle's progress, including charts and graphs that visualize key metrics such as total volume, average RIR, and other relevant data points.

## Microcycle Details Page

Route: `/microcycle/:sequence/details`

Displays detailed information about a specific microcycle, including its sequence number, date range, and a list of its workouts. Each workout is represented as a row on a table. Users can click on a workout to view the main workout page.

## Microcycle Summary Page

Route: `/microcycle/:sequence/summary`

Displays a summary of the microcycle's progress, including charts and graphs that visualize key metrics such as total volume, average RIR, and other relevant data points.

## Workout Page

Route: `/workout/:id`

Displays detailed information about a specific workout, including its name, date, and a list of exercises and sets to be performed.

## Workout Details Page

Route: `/workout/:id/details`

Displays miscellaneous details about the workout, such as notes, goals, and any other relevant information that doesn't fit into the main workout page.

## Workout Summary Page

Route: `/workout/:id/summary`

Displays a summary of the workout's progress, including charts and graphs that visualize key metrics such as total volume, average RIR, and other relevant data points.

## Manage Exercises Page

Route: `/exercises`

Displays a list of all exercises in the database, along with options to add new exercises, edit existing ones, or delete them. Each exercise is represented as a row on a table, with columns for the exercise name, primary muscle group, and other relevant information.

Exercises can be grouped into "Exercise Groups". These can categorize a part of the body like "upper body" or specific muscle groups like "biceps". Each exercise can belong to multiple groups. The exercise groups are displayed in a separate section on the page, with options to add, edit, or delete groups.

## Exercise Details Page (read-only)

Route: `/exercises/:id`

Displays detailed information about a specific exercise, including its name, primary muscle group, tutorial URL, and any notes. This page is read-only and does not allow for editing. It also includes information on all variations of the exercise that are in the database, with links to view each variation's details page.

## Edit Exercise Page

Route: `/exercises/:id/edit`

Allows users to edit the details of a specific exercise, including its name, primary muscle group, tutorial URL, and notes. Users can also manage the exercise's variations from this page, including adding new variations or editing existing ones.

## Exercise Variation Details Page (read-only)

Route: `/exercise-variations/:id`

Displays detailed information about a specific exercise variation, including its name, tutorial URL, and any notes. This page is read-only and does not allow for editing.

## Data Management Page

Route: `/data-management`

Provides options for managing the application's data, including backing up the database, restoring from a backup, and resetting the database to its initial state. This page also includes warnings about the consequences of each action and may require confirmation before proceeding with any data-altering operations.