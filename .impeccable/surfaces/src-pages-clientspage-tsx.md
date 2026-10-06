---
version: 1
slug: "src-pages-clientspage-tsx"
primary_target: "src/pages/ClientsPage.tsx"
related_targets: ["src/pages/WorkspacesPage.tsx", "src/components/Navigation.tsx", "src/App.css"]
---

# Client assignments

MODE: Operate. Extend the incumbent training-studio interface. Product behavior is owned by `PRODUCT.md`; durable visual rules remain in `DESIGN.md` and `.impeccable/design.json`.

## Direction contract

THESIS: Make the client, assigned coach, and unique client space visible together, with authorized assignment actions beside each row. Separate a coach's personal work, assigned client spaces, and team roster in both Spaces and the native space picker.

OWN-WORLD: Inherit warm paper surfaces, the pine navigation rail, green actions, Manrope headings, DM Sans body, flat ruled tables, and existing Bootstrap controls. This surface introduces no raster assets or visual identity.

STORY: Staff identify unassigned clients, claim or release their own assignments, and open accessible spaces. Organization owners and administrators can force release or choose a coach. Clients retain their space and training data; coaches use separate personal spaces.

FIRST VIEWPORT: A page title and short explanation lead into filters and search, then a four-column directory. On a 390px phone, rows stack with visible field labels and reachable actions. Retain the mobile navigation drawer.

FORM: A code-led extension of the established Clients route, using the requested assignment behavior and incumbent components. No approved comp or new-world seed applies.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Interaction contract

Show explicit assigned/unassigned state and only permitted actions. Release confirmation explains retained client data and immediate loss of coach access. An assign-coach conflict stays visible as an alert inside the open modal, with the selected coach retained. Loading, empty, success, and failure feedback use the existing operational patterns. Filters expose their selection through `aria-pressed`; row actions include the client's name in their accessible label.

## Finish evidence

The October 6 Spaces clarity update was inspected in one desktop/mobile capture round, followed by one confirmation round after fixing capture timing during modal transitions. The six final JPEGs in `docs/screenshots/space-navigation.md` show settled views of grouped Spaces, assignment context, assignment confirmation, and the client-only training route. The parent review confirmed consistent paper/pine surfaces, ruled space rows, labeled forms, clear access roles, and mobile reflow. No external reviewer or live detector verdict is claimed for this update; the Impeccable engine was unavailable, and existing project context supplied the design guidance.

The finished implementation was compared with `DESIGN.md`, `.impeccable/design.json`, the target pages and navigation, `src/App.css`, and the shared form modal. Paper/pine/green tokens, the Manrope/DM Sans hierarchy, flat ruled containers, compact controls, and modal feedback remain consistent with the incumbent system. The assignment-specific CSS reuses its palette and component rules.

All four captures were opened and checked:

- `.impeccable/review/desktop.png`: four-column directory and pine navigation at 1440px.
- `.impeccable/review/mobile.png`: full-page labeled client rows and reachable actions at 390px.
- `.impeccable/review/user-current.png`: the current 1280px viewport, with the same directory and navigation.
- `.impeccable/review/assignment-conflict.png`: the claimed-client error inside the open assign-coach modal.

The finish reviewer's final verdict pass returned **ship**, scoped to **F1 resolved**: assignment conflict feedback now appears in the modal. This verdict scores that listed fix.

The single detector run reported advisory palette/type drift, primarily pre-existing literal values versus the sparse design scale. These advisories were reported without repairing the incumbent system. `DESIGN.md`, `.impeccable/design.json`, and the prior redesign direction contract remain unchanged.
