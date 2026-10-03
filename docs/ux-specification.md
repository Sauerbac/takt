# Takt — functional UX specification

**Status:** Agreed UX direction, documented before implementation.

**Last updated:** October 3, 2026.

**Audience:** Product, design, and implementation collaborators.

This document captures the agreed interaction model for Takt. It describes what the editor should let someone do and how those actions behave. It does not prescribe visual styling, an implementation framework, a storage architecture, or an export format.

The final agreed origin is **Week 0**. References to Week 1 as the origin in the exploratory conversation are superseded.

## 1. Purpose and scope

Takt helps someone create a Gantt chart quickly, using the chart itself as the editing surface. The user should spend their time shaping the timeline rather than filling out task forms.

The motivating frustration is that existing tools can require sign-in and too much navigation through property menus. Takt should open directly into an editor without an account requirement. Dragging, context menus, and inline text editing are the primary interaction methods.

The first version is for desktop browsers with a mouse or trackpad. The interface and terminology are English, even though the product name is German.

### Included in the agreed UX

- Bars representing periods of work and milestones representing important points in time.
- Multiple bars and milestones within a row.
- Sections containing rows, with shared colors and collapsible contents.
- Whole-week timing, with relative-week and calendar-date displays.
- Direct creation, movement, resizing, reordering, and inline naming.
- Context-menu alternatives for creating bars and milestones.
- Single selection, color editing, undo/redo, and confirmation before deleting rows or sections.
- Smooth movement and resizing, including animations for bars displaced by collisions.

### Explicitly outside the current scope

- Project-management features, progress tracking, dependency arrows, and dependency-based scheduling.
- Multi-selection and bulk editing.
- Mobile or tablet interaction design.
- Persistence, autosave, cloud storage, local file formats, and document reopening.
- Export controls and output formats. For now, assume the user takes a screenshot for a presentation.
- Visual design, including typography, spacing, exact colors, icons, and the final appearance of controls. These belong to a separate session.

The general visual preference recorded for that later session is modern and corporate rather than playful. This document does not develop that direction further.

## 2. Core UX principles

1. **Edit directly.** Make an action a gesture wherever that gesture is understandable and practical.
2. **Keep context close.** Item-specific actions belong in context menus or inline controls, not a persistent property panel.
3. **Support discovery.** Visible add controls complement right-click actions. Creation hints introduce the less obvious gestures.
4. **Keep time precise.** Pointer movement can be continuous, but the resulting chart uses whole weeks.
5. **Make changes recoverable.** Undo restores a complete user action, including all bars displaced by a drag.
6. **Keep the app controls small.** The chart dominates the editor. Avoid growing the toolbar into a collection of every available command.

Small overlays are acceptable when they serve a specific interaction: choosing a calendar reference date, editing a color, or confirming deletion. Ordinary naming should happen inline.

## 3. Vocabulary and chart structure

| Term | Meaning |
| --- | --- |
| Document | The chart currently being edited. Persistence and document-management behavior are deferred. |
| Section | A named group of rows. It supplies an inherited color and can be collapsed or reordered as a unit. |
| Row | A named horizontal lane containing bars and milestones. It belongs to one section. |
| Bar | A period occupying one or more whole weeks. It has an optional label and may have a custom color. |
| Milestone | A point marking the end of a particular week. It has an optional label and may have a custom color. |
| Relative week | An integer position on the timeline, such as Week −2, Week 0, or Week 3. |
| Calendar reference | A real date assigned to the beginning of one relative week. Other calendar labels are derived from it. |
| Color override | An explicit item color that takes precedence over the section's inherited color. |

Sections and categories are the same concept for this version. There is no separate tagging or category system crossing section boundaries.

A row can contain several separate work periods. It does not need to correspond to a single task or a single uninterrupted bar. Bars in the same row cannot overlap, but they can be directly adjacent.

Moving a row between sections moves all of its contents. Moving a section moves all of its rows and their contents. These organizational changes preserve time positions.

## 4. Starting a document

A new document opens with:

- One unnamed section.
- One empty row within that section.
- A relative timeline whose fixed origin is Week 0.
- A short hint in the empty row: **“Drag to create a bar · Double-click for a milestone.”**

The hint disappears after the first item is created. Whether it returns if the document becomes empty again is not yet specified.

Week 0 exists before any item is created. The first bar does not define or shift the origin. Drawing a bar in Week 3 creates a bar in Week 3.

No document-name field is required for this draft. There is no setup form before the chart becomes usable.

## 5. Time model

### 5.1 Relative weeks

The timeline is an ordered sequence of whole weeks:

**… Week −2, Week −1, Week 0, Week 1, Week 2 …**

The origin remains fixed. Adding an earlier item extends the usable timeline to the left without renumbering existing items.

All bar starts, bar ends, and milestone placements resolve to week boundaries. There is no day-level editing or fractional-week duration.

For an unambiguous description, a bar starting at week `s` with duration `d` occupies weeks `s` through `s + d − 1`. Its left boundary is the start of week `s`; its right boundary is the start of week `s + d`.

For example, a three-week bar starting at Week 0 occupies Weeks 0, 1, and 2. Its right edge meets the start of Week 3. A second bar starting at Week 3 is adjacent to it without overlap.

### 5.2 Calendar display

The user can select a timeline label and choose a real date representing the **start of that week**. All other week labels follow from that reference in seven-day increments.

For example, assigning October 5, 2026 to the start of Week 3 makes:

| Relative position | Starting date |
| --- | --- |
| Week 0 | September 14, 2026 |
| Week 2 | September 28, 2026 |
| Week 3 | October 5, 2026 |
| Week 4 | October 12, 2026 |

The chosen date does not have to be a Monday. Each week is a seven-day period starting from the selected reference.

Calendar mode labels weeks by their starting dates. Bars still occupy whole weeks. Switching between relative and calendar displays preserves their positions and the calendar reference.

The exact date-picker interaction, date format, and behavior when calendar mode is selected before a reference exists are open details.

### 5.3 Milestone timing

A milestone created anywhere inside a week is placed at that week's **end**, visually at its right boundary.

In calendar mode, its meaning is the final date of that seven-day period. For a week beginning October 5, the milestone represents October 11, even though its visual boundary is shared with the beginning of the following week.

Dragging a milestone chooses the nearest week-ending boundary. It can also move between rows. Exact behavior for a milestone dropped directly on an existing milestone is still open.

## 6. Editor controls and navigation

### 6.1 Minimal toolbar

The agreed toolbar contains only:

- Undo.
- Redo.
- Zoom.
- Relative-week/calendar-date switch.

The document name is omitted. Item properties do not accumulate in this toolbar.

### 6.2 Navigation

| Input | Result |
| --- | --- |
| Normal vertical scrolling | Move through rows and sections. |
| Horizontal scrolling | Move through time. |
| Space-drag | Pan the chart. |
| Zoom control | Change the amount of timeline visible. |
| Ctrl/Cmd + mouse wheel | Zoom shortcut. |

Zoom changes the viewing scale, not the time precision: editing remains in whole weeks at every zoom level.

Navigation must coexist with creation gestures. An ordinary drag in empty row space creates a bar; Space-drag is the distinct panning gesture.

Exact zoom limits, initial visible range, wheel sensitivity, and whether zoom centers on the pointer are not yet specified.

## 7. Creating and naming items

### 7.1 Creating a bar by dragging

1. Press in empty timeline space within a row.
2. Drag across the desired period.
3. Preview the resulting whole-week interval.
4. Release to create the bar.
5. Make its label editable inline.

Enter finishes naming. Escape skips naming while retaining the newly created bar. A label is optional.

The distinction between escaping inline naming and cancelling an unfinished drag matters; drag cancellation is not yet specified.

### 7.2 Creating a bar through the context menu

Right-clicking a week within a row provides **“Add bar here.”** It creates a one-week bar at that row and week, then starts inline naming. End handles can subsequently extend it.

The context menu must use the location where it was opened, even if choosing the command moves the pointer away from that location.

### 7.3 Creating a milestone

Double-clicking empty row space creates a milestone at the end of the clicked week and begins inline naming.

The context menu also provides **“Add milestone here.”** It uses the same placement rule.

### 7.4 Inline editing

Double-clicking a section heading, row name, bar label, or milestone label edits that text in place. A **“Rename”** context-menu action offers another route to the same editor.

Dragging a label still moves its item; the label is not an area that blocks direct manipulation. Dedicated bar end handles remain resize targets.

Exact behavior for very small bars, labels that do not fit, and text extending outside an item is left to the interaction and visual-design follow-up.

## 8. Selection, movement, and resizing

Only one item is selected at a time. There is no Shift-click multi-selection, selection rectangle, or grouped movement of independently selected items.

### 8.1 Bar movement

Dragging anywhere on the bar body moves it in time. It can also move to a different row. Its duration is preserved.

The dragged bar follows the pointer continuously. A subtle preview indicates the whole-week result. Releasing settles the bar onto the nearest whole-week position.

### 8.2 Bar resizing

Dragging the left or right end handle changes the corresponding boundary. The result settles onto the nearest whole-week boundary.

The opposite boundary stays in place. Bars represent at least one whole week; the exact interaction at the minimum length and whether handles can cross are details to resolve before implementation.

### 8.3 Milestone movement

Dragging a milestone changes its week-ending position and can change its row. Its final location is the nearest week-ending boundary.

### 8.4 Reorganization on the left

Dragging a row's name area moves that entire row:

- To a different position within its section.
- Into another section.

Dragging a section heading reorders the section as a unit. Reordering rows or sections does not alter dates or relative weeks.

The exact drop indicators, behavior when dragging into a collapsed section, and distinction between selecting a row and dragging it are open interaction details.

## 9. Bar collisions and cascading pushes

### 9.1 Basic rule

Bars within the same row cannot overlap. Adjacency is valid: there is no required empty week between bars.

If moving or extending a bar would overlap another, the other bar moves far enough to prevent overlap. Its duration is preserved. It is not shortened, clipped, or split.

If that displacement reaches another bar, the push cascades through the affected chain.

### 9.2 Direction

- Moving horizontally to the right pushes conflicting bars right.
- Moving horizontally to the left pushes conflicting bars left.
- Extending the right boundary pushes bars on the right farther right.
- Extending the left boundary pushes bars on the left farther left.
- Dropping a bar into another row pushes conflicting bars in the destination row to the right.

Pushing has no dependency or scheduling meaning. It is the editor's way of keeping bars accessible without overlap.

### 9.3 Example

Start with three adjacent bars:

| Bar | Occupied weeks | Duration |
| --- | --- | --- |
| A | 0–1 | 2 weeks |
| B | 2–3 | 2 weeks |
| C | 4 | 1 week |

Extend A by one week:

| Bar | New occupied weeks | Duration |
| --- | --- | --- |
| A | 0–2 | 3 weeks |
| B | 3–4 | 2 weeks |
| C | 5 | 1 week |

B moves one week right and pushes C one week right. Both preserve their original durations.

### 9.4 Changes stay when the pointer reverses

If the user drags back or shrinks A after it has pushed B and C, B and C do not automatically return to their earlier positions. This applies even while the same drag gesture is still in progress.

The displaced positions are retained. Undo is the explicit way to restore the state before that gesture. Redo reapplies the completed edit.

### 9.5 Creation and other edge cases

The no-overlap rule also constrains what can be created, but the response when drawing a new bar across existing bars has not been decided. Do not silently choose between rejecting creation, limiting its range, or pushing existing bars.

Milestones are point markers rather than bars. Whether they can share a position, appear inside bars, or participate in any collision handling remains open; the agreed pushing rule concerns bars.

## 10. Motion and snapping

Smooth interaction is a core UX requirement, not a cosmetic enhancement to add later.

The system must combine two behaviors:

1. **Continuous visual tracking:** the manipulated item follows pointer motion without jumping from week to week.
2. **Whole-week results:** the preview and final result resolve to the nearest valid whole-week position or boundary.

Affected bars must visibly glide to their displaced positions. They should not teleport when a collision threshold is crossed. Cascading changes should remain readable as connected movements.

When the pointer is released, the manipulated item settles smoothly into its whole-week result. Animation must preserve the final non-overlap rule and the duration of every pushed bar.

The precise animation duration, easing, treatment of rapid pointer reversals, and reduced-motion behavior are implementation details to specify later. A smoothness requirement should not be interpreted as permission to introduce lag into direct pointer tracking.

## 11. Sections, rows, and add controls

### 11.1 Visible creation controls

Each section contains an **“Add row”** icon or button after its last row. It is not attached to the section heading.

An **“Add section”** control appears below all sections, after the last row area of the final section.

These controls provide discovery and an alternative to right-clicking. Their final styling is deferred.

### 11.2 Context-menu structure actions

Right-clicking a section provides actions to add a row and add a section.

Right-clicking a row provides insertion above or below. Rename, color-related actions, and deletion appear where applicable to the selected object.

The exact placement of a new section created from a section's context menu, and the names assigned to new rows and sections, remain open.

### 11.3 Collapse and expansion

A section can collapse to hide its rows and expand to reveal them again. Collapsing does not remove items or change their time positions.

How the add-row control appears in a collapsed section, and whether a new row automatically expands that section, are not yet specified.

## 12. Colors and inheritance

Start with any reasonable default palette. Exact palette selection belongs to visual design.

A compact palette within the context menu edits section, bar, and milestone colors. A persistent property panel is not needed.

The inheritance rules are:

- A section supplies the default color for items in its rows.
- A row has no independent color setting.
- A bar or milestone can override the inherited color.
- **“Use section color”** removes an item override.
- Changing the section's color updates items that inherit it.
- Moving an item or an entire row to another section adopts the destination color for items without overrides.
- Explicit overrides survive movement between sections.

Whether the palette includes arbitrary custom-color entry in the first draft is not settled.

## 13. Deletion and undo/redo

### 13.1 Confirmation

Deleting a row or section requires confirmation. The confirmation should make the scope understandable: a row deletion also removes its items; a section deletion also removes its rows and all their items.

Cancelling the confirmation leaves the chart unchanged. Confirmed deletion remains undoable.

Confirmation for individual bars and milestones is not part of the agreed requirement. Exact deletion shortcuts and whether empty rows or sections use the same confirmation are open details.

### 13.2 Undo boundaries

Undo and redo must cover creation, movement, resizing, naming, recoloring, row and section reorganization, and deletion.

A completed drag is one action even when it pushes several bars. Undo restores the complete state before that gesture, including every affected bar's position. Redo restores the complete resulting state.

For the collision example above, one undo returns A, B, and C to their original ranges. The user does not need to undo each push separately.

Exact keyboard shortcuts, undo treatment of view changes, and how repeated text input is grouped are not yet specified.

## 14. Acceptance scenarios

These are behavioral checks for the eventual implementation, not a request to build automated tests during documentation.

| Scenario | Expected result |
| --- | --- |
| Open a new document | One unnamed section, one empty row, relative weeks, fixed Week 0, and a creation hint are visible. |
| Draw the first bar at Week 3 | It stays at Week 3; the origin is not reassigned. |
| Add content before Week 0 | Negative weeks are available; existing items retain their relative positions. |
| Drag across empty row space | A whole-week bar is created and its label becomes editable inline. |
| Use “Add bar here” | A one-week bar is created at the context-menu location. |
| Double-click empty space in Week 2 | A milestone is created at the end of Week 2. |
| Drag a bar by its label | The bar moves; text does not block dragging. |
| Double-click the same label | The label becomes editable in place. |
| Resize into an adjacent bar | The other bar moves without changing duration. |
| Push into a chain of bars | All necessary bars move smoothly; no final overlap remains. |
| Reverse a drag after pushing other bars | Pushed bars retain their displaced positions. |
| Undo that completed drag | All affected items return to their pre-gesture state in one undo. |
| Drop a bar into an occupied row | Conflicting destination bars are pushed right with durations preserved. |
| Move a row between sections | Its items preserve their time positions and follow the color-inheritance rules. |
| Reorder a section | Its rows and items move together without changing time positions. |
| Delete a populated section | Confirmation explains the contents affected; cancellation changes nothing; confirmed deletion is undoable. |
| Assign a calendar date to Week 3 | All calendar labels follow that week-start reference at seven-day intervals. |
| Switch back to relative weeks | Positions and the calendar reference are preserved. |
| Zoom or pan | Only the view changes; editing precision remains whole weeks. |

## 15. Remaining decisions

The core direction is agreed. The following are genuine gaps, not implicit requirements:

1. **Creation collisions:** what happens when a newly drawn or menu-created bar conflicts with an existing bar?
2. **Drag cancellation:** how does the user cancel an unfinished gesture, and does cancellation restore all pushed bars?
3. **Snapping ties and minimum duration:** how are exact halfway positions resolved, and what happens at a bar's minimum length?
4. **Calendar setup:** what happens when calendar mode is selected before a reference date exists, and how can the reference be replaced?
5. **Milestone coexistence:** can multiple milestones share a boundary, and how are milestones placed over bars handled?
6. **Deletion details:** individual-item deletion, keyboard shortcuts, and confirmation for empty containers.
7. **Structural insertion:** the position of a context-created section, naming defaults, and collapsed-section drop/add behavior.
8. **Dense content:** editing labels on small bars and handling long names without losing drag targets.
9. **Navigation and motion details:** initial range, zoom limits, animation timings, and reduced-motion behavior.
10. **Undo details:** keyboard shortcuts, text-edit grouping, and whether calendar-reference changes belong to undo history.

Resolve these as focused interaction decisions before the affected behavior is implemented. Visual styling, persistence, and export remain separate future workstreams.
