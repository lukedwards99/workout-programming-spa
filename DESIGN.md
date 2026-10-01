---
name: LiftLog
description: A focused training workspace shaped by printed prescription sheets and equipment schedules.
colors:
  paper: "#f6f5ef"
  surface: "#fffefa"
  ink: "#23352d"
  muted: "#657168"
  pine: "#183e31"
  pine-deep: "#153428"
  green: "#28724e"
  green-hover: "#205d40"
  sage: "#e6ece1"
  line: "#dce0d5"
  danger: "#a33c30"
  danger-bg: "#fff0eb"
  focus: "#327955"
  white: "#ffffff"
  nav-active: "#d5e5bd"
  nav-text: "#c9d8ca"
  nav-hover: "#234f3e"
  field-border: "#b9c3b6"
  field-focus: "#d3e2ca"
  continuation: "#dce8c9"
  sheet-header: "#eff2e8"
typography:
  display:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(48px, 5.3vw, 78px)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(32px, 3vw, 42px)"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  section-title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.55
  button:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
  navigation:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.55
rounded:
  tag: "4px"
  icon: "6px"
  field: "7px"
  navigation: "8px"
  container: "14px"
  dialog: "16px"
spacing:
  field-label: "5px"
  action-gap: "8px"
  compact: "12px"
  standard: "16px"
  group: "20px"
  row: "24px"
  container: "26px"
  dialog-inline: "28px"
  section: "32px"
  desktop-gutter: "48px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "{colors.white}"
    typography: "{typography.button}"
    rounded: "{rounded.field}"
    padding: "11px 17px"
  button-primary-hover:
    backgroundColor: "{colors.green-hover}"
    textColor: "{colors.white}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.field}"
    padding: "11px 17px"
  button-outline-hover:
    backgroundColor: "{colors.sage}"
    textColor: "{colors.pine}"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.white}"
    typography: "{typography.button}"
    rounded: "{rounded.field}"
    padding: "11px 17px"
  button-paper:
    backgroundColor: "#e9f0dc"
    textColor: "{colors.pine}"
    typography: "{typography.button}"
    rounded: "{rounded.field}"
    padding: "11px 17px"
  text-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
  navigation-link:
    backgroundColor: "transparent"
    textColor: "{colors.nav-text}"
    typography: "{typography.navigation}"
    rounded: "{rounded.navigation}"
    padding: "13px 15px"
  navigation-link-active:
    backgroundColor: "{colors.nav-active}"
    textColor: "{colors.pine-deep}"
  filter-chip:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.icon}"
    padding: "8px 13px"
  filter-chip-active:
    backgroundColor: "{colors.sage}"
    textColor: "{colors.pine}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.container}"
    padding: "26px"
  program-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    padding: "24px 0"
  set-sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.container}"
---

# Design System: LiftLog

## Overview

**Creative North Star: "The Training Studio Prescription Sheet"**

LiftLog takes its visual character from a training studio's printed prescription sheets and equipment schedule. Warm paper, a pine navigation rail, leafy green actions, and consistently ruled rows make the workspace feel calm, practical, and ready for repeated use. Manrope gives headings a clear, compact structure; DM Sans keeps the supporting text and editable values easy to read.

The system supports frequent program editing at a desktop and workout recording on a phone. Density belongs in aligned rows and labeled fields, with enough space to distinguish an exercise, its sets, and its planned and executed values. The durable signature is a ruled training sheet with feedback beside the edited set. Icons use simple strokes; the approved interface requires no raster imagery or invented metrics.

**Key Characteristics:**

- Warm paper with deep pine navigation and restrained green actions.
- Flat surfaces, fine rules, and aligned operational rows.
- Manrope hierarchy paired with readable DM Sans text.
- Explicit value labels and tabular numerals for training data.
- Planned and executed fields that stack comfortably on a phone.

## Colors

The palette feels like paper, ink, and painted studio equipment: warm neutrals carry the work, dark pine anchors navigation, and green identifies actions and saved state. Frontmatter values are normative; the CSS custom properties in `src/App.css` are the implementation source.

### Primary

- **Leaf Green** (`green`): primary actions, links, selected field borders, and inline saved feedback. Use **Deep Leaf** (`green-hover`) for the corresponding hover and active treatment.
- **Pine** (`pine`): persistent navigation and the login story surface. **Deep Pine** (`pine-deep`) supplies text on the light selected navigation row.
- **Young Leaf** (`nav-active`): active rail item and its keyboard focus outline. It makes the current destination visible inside the dark rail.
- **Continuation Leaf** (`continuation`): the program continuation surface. Preserve its contextual purpose rather than making every container green.

### Secondary

- **Terracotta** (`danger`): destructive actions. **Pale Clay** (`danger-bg`) supplies error surfaces so failure remains visible near the relevant action.

### Neutral

- **Warm Paper** (`paper`): application background and account header.
- **Clean Sheet** (`surface`): editable fields, contained forms, training sheets, and dialogs. **White** (`white`) supplies primary and destructive button text.
- **Pine Ink** (`ink`): headings, values, and body text. **Soft Ink** (`muted`) supplies descriptions, labels within a set, and secondary metadata.
- **Sage** (`sage`): restrained hover fills, avatars, and selected filters.
- **Paper Rule** (`line`): row dividers, container edges, and section separation. **Sheet Header** (`sheet-header`) gives tables and set sheets a quiet column heading band.
- **Rail Mist** (`nav-text`) and **Rail Hover** (`nav-hover`): readable default rail labels and their hover fill.
- **Field Edge** (`field-border`): input boundaries. **Field Halo** (`field-focus`) accompanies the green focused border. **Focus Green** (`focus`) supplies the standard keyboard outline.

**The Action Green Rule.** Green identifies an action, selection, or saved state. Keep primary text in Pine Ink and supporting text in Soft Ink so the action remains easy to locate.

## Typography

**Display and Heading Font:** Manrope, with a sans-serif fallback.

**Body and Control Font:** DM Sans, with a sans-serif fallback. Both families are bundled locally through Fontsource in `src/main.tsx`.

**Character:** Manrope's close spacing creates purposeful headings without ornamental display treatment. DM Sans carries the denser operational layer: metadata, controls, table cells, and values.

### Hierarchy

- **Display:** the large login statement; use the frontmatter display role only for that expansive introductory treatment. Its mobile expression is smaller (46px).
- **Headline:** page identity at the top of the working surface. The mobile heading settles to a fixed size (32px).
- **Title / Section Title:** modal and section headings, with a smaller step for nested headings. Program row titles use a more compact Manrope treatment (17px desktop, 16px mobile).
- **Body:** default prose and values. Page subtitles use a slightly larger size (16px) and a restrained line length (65ch); supporting descriptions commonly use smaller text (12–14px).
- **Label:** visible form labels. Set-value labels are deliberately compact (10px); their numeric inputs become larger on mobile (16px) to support entry.
- **Button / Navigation:** steady medium-to-semibold controls. Uppercase is reserved for compact table/set headers and the test-mode tag, with light tracking; ordinary action labels remain sentence case.

**The Value Alignment Rule.** Use tabular numerals for counts, summaries, set numbers, and numeric input values. Keep each number with an explicit label and its unit where relevant.

## Layout

The desktop application places a fixed pine rail beside the working surface (232px). Main content is centered with a generous maximum width (1420px) and desktop inset (42px top, 48px sides, 70px bottom). The topbar, content, and test-session band share the same horizontal alignment. The account header has a quiet minimum height (90px), while page headings and actions form a clear opening row.

Use ruled lists for repeated operational items. Program rows align a small document symbol, name and real metadata, then trailing actions. Mesocycle containers and exercise sheets use the same fine dividers and consistent spacing. The observed rhythm combines compact control gaps, medium row padding, and wider section separation; use the frontmatter spacing values without forcing every distance onto an artificial single base unit.

The Programs surface adds a narrow context column (232px), separated from the flexible main column by a gap (38px). This is a surface composition, not a requirement for every page. At the desktop compression breakpoint (1200px), the rail reduces (210px), content insets reduce (32px), and that context column narrows (200px). At the intermediate breakpoint (1020px), the context column moves below the work and the set-number column narrows (36px).

At the phone breakpoint (767px), the rail becomes a reachable drawer, the page uses horizontal insets (22px), and header actions wrap below the title. Planned and executed values stack within each set, with separate visible labels and a dashed division. Each value group retains three equal flexible columns; set inputs must shrink within the available width. Wide administrative tables scroll inside their own wrapper rather than expanding the page. Dialog insets and container padding also tighten for mobile.

## Elevation & Depth

Working surfaces are flat. Paper tones, thin borders, and ruled rows provide hierarchy; cards and buttons have no shadows. Dialogs alone lift above the work with a diffuse pine-tinted shadow and dim backdrop. This preserves depth as a temporary interaction state.

### Shadow Vocabulary

- **Dialog lift** (`0 18px 65px #13281e30`): modal content only.
- **Pine backdrop** (`#13281e`, opacity `.45` for the modal backdrop): dims the underlying workspace during a dialog. The mobile drawer uses the same backdrop hue.

**The Flat Workbench Rule.** Keep everyday lists, training sheets, cards, and buttons flat. Reserve elevation for a dialog that temporarily sits above the workspace.

## Shapes

Containers use gently curved paper corners; fields and buttons use a tighter curve. Rounded values in the frontmatter distinguish container, dialog, control, navigation, and tag roles. Do not apply the container radius to every nested element. Circular avatars are an exception used for account recognition.

Fine one-pixel borders define fields, containers, and rows. Program rows remain open against the page rather than becoming separate rounded cards. The icon vocabulary uses inline SVG strokes (1.7px), rounded stroke caps, and simple silhouettes; ordinary icons are small (20px). A larger angled barbell may accompany the continuation panel, but it disappears when space is limited.

## Components

### Buttons

Steady, compact, and easy to identify.

- **Primary:** Leaf Green with white text, the control radius, standard padding, and a comfortable minimum height (44px).
- **Outline:** transparent fill, Pine Ink text, and a visible pale green-gray edge (`#bbc5b6`). Hover adds Sage and a stronger edge (`#aab7a1`).
- **Danger:** Terracotta with white text; hover darkens the clay (`#87352c`). Use it for destructive actions.
- **Paper:** a pale leaf fill (`#e9f0dc`) with Pine text inside the continuation panel; hover becomes white.
- **Compact:** smaller operational buttons use reduced type and padding (12px, 8px 12px) with a lower minimum height (36px). Icon actions are square (42px), with a Sage hover fill.
- **States:** background and text color transitions are short (`.16s ease`). Keyboard focus uses a visible green outline (3px, offset 3px); disabled buttons lower opacity (`.55`) and stop inviting interaction. Keep loading labels attached to the pending action.

### Chips

Quiet classification and selection.

- **Filters:** outline chips use compact text (12px), short padding (8px 13px), and the icon radius. Selection adds Sage, Pine text, and a stronger green-gray border (`#a8baa0`).
- **Passive tags:** compact badges use Sage with muted green text, the tag radius, and small type (11px). The test-mode tag is outlined, uppercase, and visually distinct from account identity.
- **State:** label selection explicitly with the relevant accessible state. Do not make passive status badges look like primary actions.

### Cards / Containers

Clean sheets containing a coherent task.

- **Surface:** Clean Sheet, a Paper Rule border, the container radius, and normal container padding. Padding tightens on a phone (20px).
- **Contents:** use section headings, plain descriptions, and internal ruled rows. Tables can remove their extra outer frame when already inside a card.
- **Depth:** remain flat at rest, following the Flat Workbench Rule.

### Inputs / Fields

Explicit, quiet, and ready for repeated entry.

- **Style:** Clean Sheet background, Pine Ink values, a Field Edge border, the control radius, and standard field padding. Normal text fields have a comfortable minimum height (44px).
- **Focus:** a Leaf Green border and Field Halo outline (2px, offset 1px). Focus must stay visible in both paper and pine contexts.
- **Labels:** associate a persistent visible label with each field. Set inputs additionally distinguish planned/target values from actual values in their accessible names.
- **Disabled:** use a muted paper fill (`#efefe7`) and readable muted ink (`#727b70`), preserving full opacity. Read-only permission context must remain understandable beside the field.
- **Feedback:** error surfaces sit in the relevant form; save status stays alongside the edited set section. Preserve entered values when a save fails.

### Navigation

A persistent anchor to the training workspace.

- **Desktop:** fixed Pine rail, simple stroke icons, compact labels, comfortable inset rows, and a pale selected fill. Secondary account and environment information sits quietly below the main destinations.
- **Active / Hover / Focus:** current destination uses Young Leaf with Deep Pine text; hover uses Rail Hover with white text; keyboard focus uses the pale selected outline so it stays visible on Pine.
- **Context:** the topbar shows the selected workspace and account; a separate test-session band makes simulated identity visible. Controls and destinations reflect the account's actual permissions.
- **Mobile:** a menu button opens the pine drawer. Provide a labeled close control, keep keyboard focus inside the open drawer, and close it after navigation. Preserve a keyboard skip link to the main content.

### Ruled Program Row

An open row with a document symbol, a compact program name, real owner and cycle/workout counts, and trailing actions. A Paper Rule divider separates adjacent rows. Long names wrap within the body; they must not displace the action column off screen. On a phone, actions condense while the name and metadata remain readable.

### Planned / Executed Set Sheet

Each exercise is one contained sheet. Desktop rows align set number, planned values, and executed values beneath a quiet column heading band. Strength and cardio share this structure, with the relevant labels and units. Each group contains three numeric inputs, a notes field, and its own save action when allowed by the current role.

On a phone, each set presents Planned first and Executed below it. Keep both group labels visible, preserve the field labels, and show Saved or an error beside the relevant set. Set type or distance unit sits in a separate subdued strip and is saved with the plan. Feedback must never rely on color alone.

## Do's and Don'ts

### Do:

- **Do** use warm paper as the working canvas and pine as the navigation anchor.
- **Do** carry the same fine rules and aligned row rhythm across programs, workouts, exercises, and administration.
- **Do** label numeric values explicitly and use tabular numerals for training data.
- **Do** keep planned and executed values visually distinct, with save feedback beside the edited set.
- **Do** retain visible keyboard focus, permission context, and a reachable mobile navigation drawer.
- **Do** use the implemented short state transitions and honor reduced-motion preferences.

### Don't:

- **Don't** add raster decoration or invented activity metrics to this operational interface.
- **Don't** replace open program rows with a grid of detached shadowed cards.
- **Don't** apply everyday shadows to cards, lists, training sheets, or buttons.
- **Don't** force phone set entry into a wide desktop sheet that makes the page scroll horizontally.
- **Don't** substitute placeholders for visible field labels or use color as the only feedback signal.
- **Don't** let account switching leave the prior user's workspace, route, or role controls on screen.
