# Summary Statistics Page Improvement Plan

## Goal

Improve the program and mesocycle summary views so that:

1. Set-type filtering is located with the “By Exercise Group” and “By Exercise” tables and uses a modern, accessible multi-select treatment.
2. Exercise and exercise-group names remain visually separate from a polished expand/collapse control aligned to the far right.
3. Summary metrics have a clear information hierarchy instead of appearing as one undifferentiated grid of boxes.
4. Every interaction remains usable and readable on mobile.

This plan preserves the existing summary calculations and focuses the implementation on component structure, interaction design, responsive styling, accessibility, and test coverage.

## Current implementation

The relevant code is shared across several screens:

- `src/pages/ProgramSummaryPage.tsx` loads the program summary, renders the global set-type control, summary metrics, and both breakdown tables.
- `src/pages/MesocyclePage.tsx` renders the same summary UI inside its Summary tab.
- `src/pages/WorkoutPage.tsx` uses the set-type control and summary metrics but does not have breakdown tables.
- `src/components/summary/SummarySetTypeFilter.tsx` owns the shared selected-set-type state and renders native checkboxes.
- `src/components/summary/SummaryBreakdownTables.tsx` renders both tables, column controls, row toggles, and expanded set-type details.
- `src/components/summary/SummaryStatGrid.tsx` converts summary totals into one flat list of metric cards.
- `src/App.css` contains the shared summary and responsive-table styles.
- `tests/e2e/summary-statistics.spec.ts` covers filtering, totals, breakdowns, column preferences, and expanded rows.

Important constraints discovered in the current design:

- The selector is a multi-select control even though it may look like a radio-button group. It must retain checkbox semantics because users can include any combination of set types.
- One `selectedSetTypes` value currently recalculates the totals, both breakdown tables, and each expanded set-type breakdown. The two relocated controls should remain synchronized views of that one state unless independent table filtering becomes a separate product requirement.
- The provider is mounted around the whole app, so the selection is currently shared while navigating within the SPA and resets to all set types after a full reload.
- Workout summaries do not have “By Exercise Group” or “By Exercise” tables. The improved filter should remain near the workout summary metrics on that screen.
- Program and mesocycle pages currently hide both breakdown cards when `totalSets` is zero. After moving the filter into those cards, the cards and controls must always remain visible so a user who deselects every option can recover.

## Proposed experience

### Page hierarchy

Use the following order on program and mesocycle summaries:

1. Existing scope note: “Strength programmed statistics — cardio exercises are not included.”
2. A structured “Overview” region containing grouped summary metrics.
3. “By Exercise Group” card with its set-type control, column control, table, and per-card empty state.
4. “By Exercise” card with the same synchronized set-type control, its own column control, table, and per-card empty state.

On workout summaries, keep:

1. Existing scope note.
2. Improved set-type control.
3. Structured overview metrics.

The tables do not exist at workout scope, so removing the selector there would remove filtering functionality.

### Set-type control

Render each set type as a selectable chip/segmented option:

- Keep a real `<input type="checkbox">` for every option.
- Visually hide the native checkbox without removing it from the accessibility tree.
- Style its label as a rounded, bordered chip with clear default, hover, selected, and keyboard-focus states.
- Use the existing set-type color language where practical: warm-up blue, normal green, dropset amber, failure red, and rest-pause purple. Use color as reinforcement only; selected state must also have a visible fill/border/check indicator.
- Rename the visible legend to the shorter “Set types” inside table cards. Add accessible context such as `aria-label="Set types included in summary"` or helper text that clarifies the selection updates all summary metrics and both tables.
- Give each rendered instance a unique test identifier and accessible group label, for example:
  - `exercise-group-set-type-filter`
  - `exercise-set-type-filter`
  - `workout-set-type-filter`
- Keep both table-card controls synchronized through `useSummarySetTypeFilter()`. Selecting an option in one card must immediately update the other control, overview totals, table rows, percentages, and expanded details.

Do not replace the checkboxes with actual radio inputs. Radio inputs would incorrectly imply exactly one set type can be selected.

### Table headers and controls

Refactor the table card header into two layers:

- Title row: section title on the left and the existing “Columns” control on the right.
- Filter row: the set-type fieldset below the title row, spanning the available card width.

This keeps the title and column preferences easy to scan while giving the five set-type chips enough space. `TableHeader` can accept a filter/control slot instead of trying to fit every control into one narrow row.

The set-type filter is global to the displayed summary, while column visibility remains independent for each table and continues using the existing local-storage keys.

### Row name and detail toggle

Replace text such as “Show details: Bench Press” with a first-cell layout containing two separate elements:

- Left: the group or exercise name as normal row content, preferably a `<span>` or `<strong>`.
- Right: a compact icon button with a chevron that points down when collapsed and up when expanded.

Implementation details:

- Add a wrapper such as `.summary-row-primary` with `display: flex`, `align-items: center`, `justify-content: space-between`, and a gap.
- Let the name wrap when needed while keeping the toggle pinned to the far right.
- Use a styled button with a border, hover background, and a minimum 44×44 px interactive area on touch layouts. Desktop can appear visually compact while retaining an adequate hit target.
- Prefer a CSS chevron or a small inline SVG so no icon dependency is added solely for this control.
- Keep visible supplementary text such as “Details” on wider screens if it improves clarity; on narrow screens the icon can stand alone.
- Set a complete accessible name that changes with state, such as “Show details for Bench Press” and “Hide details for Bench Press.”
- Preserve `aria-expanded`.
- Add `aria-controls` pointing to a stable ID on the corresponding detail region.
- Rotate or swap the chevron based on `aria-expanded`; do not rely on color alone.
- Keep the toggle as a `<button type="button">` so it remains keyboard operable and cannot accidentally submit a surrounding form in a future reuse.

The expanded set-type table should remain directly after its parent row and should continue listing only the currently selected set types.

### Organized summary metrics

Replace the single flat `stats-grid` presentation with a semantic overview containing named metric groups:

1. **Program structure**
   - Program: mesocycles, workouts, exercises, variations.
   - Mesocycle: mesocycle days, workouts, exercises, variations.
   - Workout: exercises and variations.
2. **Sets**
   - Selected sets, working sets, and warm-up sets.
3. **Workload**
   - Programmed reps and programmed volume.
4. **Averages**
   - Average reps per selected set and average RIR.

Recommended visual treatment:

- Render each category as one surface/panel with a small section heading.
- Within a panel, render metrics as compact key-value items rather than giving every number a separate heavy outer box.
- Emphasize the value, keep the label secondary, and use dividers or spacing to separate adjacent values.
- Retain one clearly visible “Overview” heading or accessible region label.
- Avoid icons unless they add meaning consistently across every group.

Refactor `SummaryStatGrid.tsx` toward a grouped data model, for example:

```ts
interface StatItem {
  label: string;
  value: string;
}

interface StatSection {
  id: 'structure' | 'sets' | 'workload' | 'averages';
  title: string;
  stats: StatItem[];
}
```

Replace or extend `buildStatItems` with a `buildStatSections` helper. Pass scope-specific structure metrics explicitly so “Mesocycles” and “Mesocycle Days” are placed in the correct category rather than appended to the end of a flat list. Preserve the existing formatters and displayed values; this is an information-architecture change, not a calculation change.

Consider keeping compatibility classes during the first pass only if they reduce unrelated test churn. New tests should target semantic regions, labels, and dedicated test IDs instead of relying entirely on `.stat-card` ordering.

## Component changes

### `src/components/summary/SummarySetTypeFilter.tsx`

1. Keep `SummarySetTypeFilterProvider` and its current selection behavior.
2. Add props to the visual control:
   - `ariaLabel` or contextual legend
   - `testId`
   - optional `compact`/placement variant if workout spacing differs from table-card spacing
3. Generate stable input IDs so labels remain explicitly associated with inputs even when multiple synchronized copies are mounted.
4. Add selected-state hooks through `:checked + label`, a wrapper class, or an explicit selected class.
5. Keep toggling functional when zero types are selected.

### `src/components/summary/SummaryBreakdownTables.tsx`

1. Render one contextual `SummarySetTypeFilterControls` instance inside each table card.
2. Extend `TableHeader` into a table-toolbar component with a title row and filter row.
3. Always render both `data-card` containers and their toolbars.
4. Move the no-results message inside the appropriate card:
   - No types selected: “Select at least one set type to see exercise groups/exercises.”
   - Types selected but no matches: retain a scope-specific no-results message.
5. Replace combined name/toggle text in `GroupRows` and `ExerciseRows` with the flex layout and chevron button.
6. Add stable IDs connecting each row button to its detail content.
7. Add classes that distinguish parent data rows from detail rows so mobile table-card CSS does not style them identically.
8. Keep expanded-row state local and preserve existing behavior when filters change. If an expanded entity disappears after filtering, allowing its key to remain in the in-memory set is harmless; it can reappear expanded if the filter is restored.

### `src/components/summary/SummaryStatGrid.tsx`

1. Introduce the grouped section model.
2. Render semantic section headings and compact metric lists.
3. Keep the existing formatting functions.
4. Rename CSS classes to reflect the new structure, while optionally retaining `stats-grid` as a top-level compatibility hook during migration.

### `src/pages/ProgramSummaryPage.tsx`

1. Remove the top-level filter instance.
2. Build and render grouped overview sections.
3. Render `SummaryBreakdownTables` even when there are zero selected/matching sets.
4. Stop using the page-level empty state in place of the breakdown cards; let each table card explain why it has no rows.
5. Continue recalculating the full summary from `selectedSetTypes`.

### `src/pages/MesocyclePage.tsx`

Apply the same program-summary changes inside the Summary tab:

1. Remove its top-level filter.
2. Use the grouped overview with “Mesocycle Days” in the structure group.
3. Always render the breakdown cards once `summaryData` is available.
4. Preserve schedule/summary navigation and existing loading behavior.

### `src/pages/WorkoutPage.tsx`

1. Keep one improved set-type selector because no breakdown table exists at workout scope.
2. Use the grouped overview layout.
3. Give the filter its workout-specific accessible label and test ID.
4. Verify that edits to workout sets still recalculate the grouped values.

### `src/App.css`

Add or revise styles for:

- Chip-based set-type controls and their selected, hover, disabled, and `:focus-visible` states.
- Two-level table toolbars.
- The name/toggle row layout and chevron animation.
- Grouped overview panels and compact metric items.
- Detail-row containment and horizontal scrolling.
- Mobile-specific stacking, spacing, touch targets, and overflow handling.

Use the existing CSS variables and set-type badge colors rather than introducing a second theme vocabulary.

No database schema or SQL changes are expected. `summaryApi` already accepts the selected set types and returns all metrics required by this redesign.

## Mobile behavior

Treat mobile behavior as part of each component rather than as a final CSS patch.

### Breakpoints and layout

- At tablet widths, allow metric-category panels to form a two-column grid.
- At phone widths (`max-width: 575px`, matching the current responsive-table breakpoint), stack category panels in one column.
- Inside a category panel, use two compact metric columns when labels and values fit; fall back to one column at very narrow widths (approximately 360 px or below) if wrapping becomes crowded.
- Reduce `data-card` padding on phones so tables and controls have useful content width.

### Set-type chips

- Let chips wrap onto multiple lines rather than shrinking text or forcing page-level horizontal scrolling.
- Make each chip at least 44 px tall or provide an equivalent 44 px touch target.
- Keep the focus ring visible and outside the selected fill.
- Ensure five options fit cleanly at 320 px through wrapping.
- Do not use a hover-only affordance.

### Table rows

- Continue using the current card-style responsive rows below 575 px.
- Make the first cell a clear header row containing the name on the left and detail button on the right.
- Suppress the generic `data-label` pseudo-label for this first-cell header if it duplicates “Group” or “Exercise.”
- Ensure long names wrap without pushing the toggle off-screen.
- Keep the detail toggle reachable with one hand and large enough to tap reliably.
- Give expanded detail rows dedicated mobile rules so they do not inherit all parent-card spacing and pseudo-label behavior.
- Keep the nested set-type breakdown horizontally scrollable inside the card. The page itself must not scroll horizontally.
- Consider a subtle edge fade or “Swipe to see more” hint for the nested seven-column table if usability testing shows users do not discover horizontal scrolling.

### Header controls and empty states

- Stack the title/filter layout vertically on small screens.
- Keep “Columns” aligned with the title row and give its `<summary>` an adequate touch target.
- Ensure the column-options panel stays within the viewport; use right alignment and a constrained maximum width.
- Always display both table toolbars when no set types are selected so the user can restore a selection.
- Avoid the existing large generic empty-state padding inside a table card; use a compact inline empty state beneath the filter.

### Mobile validation sizes

Manually verify at minimum:

- 320×568: narrow phone and worst-case wrapping.
- 375×667 or 390×844: common phone size.
- 575 px wide: exact responsive-table boundary.
- 768 px wide: tablet transition.

Check both portrait layout and keyboard focus order.

## Accessibility requirements

- Preserve native checkbox semantics for set-type multi-selection.
- Associate every checkbox and label explicitly and prevent duplicate IDs across the two synchronized controls.
- Give each fieldset an accessible legend or group label that identifies its context.
- Use visible `:focus-visible` styles for chips, column controls, and detail toggles.
- Give icon-only controls meaningful stateful accessible names.
- Preserve `aria-expanded` and add `aria-controls`.
- Do not communicate selected/expanded state through color alone.
- Maintain sufficient contrast using the existing dark-theme palette.
- Keep DOM order consistent with visual order: overview, group breakdown, exercise breakdown.
- Verify all functions using keyboard-only navigation and at 200% zoom.

## Test plan

### Update existing Playwright coverage

Revise `tests/e2e/summary-statistics.spec.ts` to:

1. Locate the program/mesocycle filter through its new card-specific test ID instead of the removed page-level test ID.
2. Assert that both table-card filters start with the same checked values.
3. Toggle “Normal” in the exercise-group filter and assert:
   - The matching chip in the exercise filter becomes unchecked.
   - Overview totals recalculate.
   - Both table datasets recalculate.
   - Expanded detail tables omit “Normal.”
4. Deselect every set type and assert:
   - Both table cards and both filter controls remain visible.
   - Both cards show the correct compact empty state.
   - Re-selecting a type restores rows and totals.
5. Expand a group and an exercise using accessible names such as “Show details for Chest” and “Show details for Bench Press.”
6. Assert `aria-expanded` changes and the controlled detail region appears/disappears.
7. Verify the name is plain row content and is not embedded in the button text.
8. Retain the independent column-preference persistence test.
9. Update metric selectors for the grouped overview while retaining the existing numeric expectations.
10. Keep the workout-summary filter test pointed at the workout-specific control.

### Add mobile Playwright coverage

Add a focused mobile test or a mobile describe block that sets a phone viewport and verifies:

- Metric groups stack without horizontal page overflow.
- Set-type chips wrap and remain clickable.
- A long exercise name and the detail button remain inside the first-cell bounds.
- The detail button has an adequate bounding box.
- Expanding details does not create document-level horizontal scrolling.
- The nested breakdown container can scroll horizontally.
- Both filters remain usable in the all-deselected state.

Prefer assertions on behavior and bounding boxes over pixel-perfect screenshots. A small visual snapshot may be added if the project adopts stable screenshot testing, but it should not be the only regression protection.

### Regression commands

Run:

```sh
npm run typecheck
npm run build
npm run test:e2e -- tests/e2e/summary-statistics.spec.ts
```

Then run the full end-to-end suite because `SummaryStatGrid` and the filter are also used by workout, tutorial, cardio, regression, and program-data-related tests:

```sh
npm run test:e2e
```

## Implementation sequence

1. **Define the grouped metric model.**
   - Add `StatSection` and a scope-aware builder.
   - Convert program, mesocycle, and workout summaries.
   - Confirm all existing displayed values remain unchanged.
2. **Modernize the reusable filter.**
   - Add contextual props, unique IDs, chip markup, and accessible states.
   - Style and test it first in the workout view, where only one instance renders.
3. **Move synchronized filters into both breakdown cards.**
   - Refactor the table toolbar.
   - Remove the program and mesocycle top-level filters.
   - Keep cards mounted for zero-selection and zero-result states.
4. **Redesign expand/collapse rows.**
   - Separate name content from the action.
   - Add chevrons, stateful accessible names, and controlled-region IDs.
5. **Implement responsive styles.**
   - Handle overview panels, chip wrapping, table-card padding, first-cell headers, and detail-row overflow.
6. **Update end-to-end tests.**
   - Migrate selectors.
   - Add synchronized-filter, recovery, accessibility-state, and mobile coverage.
7. **Run focused and full validation.**
   - Typecheck, production build, focused Playwright test, full suite, and manual keyboard/mobile review.

## Acceptance criteria

- Program and mesocycle summary pages no longer show a standalone set-type selector above the overview.
- “By Exercise Group” and “By Exercise” each contain a modern chip-style multi-select control.
- The two controls always display and modify the same selection.
- Changing either control updates the overview, both breakdown tables, percentages, and detail rows.
- Deselecting every type does not remove the controls; the user can restore data without reloading.
- Workout summaries retain one improved filter and continue recalculating correctly.
- Exercise/group names are left-aligned plain content; a polished detail control is aligned at the far right.
- The detail control communicates state visually and to assistive technology.
- Summary metrics are grouped into structure, sets, workload, and averages with a clear hierarchy.
- No summary calculation or formatting changes unintentionally.
- At 320 px and wider, controls wrap cleanly, touch targets are usable, names do not collide with toggles, and the document has no horizontal overflow.
- Expanded detail tables remain usable through contained horizontal scrolling on mobile.
- Typecheck, build, focused summary tests, and the full end-to-end suite pass.

## Out of scope

- Changing summary SQL calculations or adding new metrics.
- Adding independent set-type selections for the two tables.
- Persisting set-type selection across full browser reloads.
- Redesigning non-summary tables across the rest of the app.
- Adding a new icon library solely for the detail chevron.

These can be considered separately after the redesigned summary page is validated.
