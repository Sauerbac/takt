# Takt — functional UX specification

**Status:** Agreed UX direction, refined for the first implementation milestone.

**Last updated:** October 7, 2026.

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
- Pixel-level visual implementation choices that are not fixed by the selected prototype.

The selected Apricot prototype is the visual reference. This functional specification does not duplicate its typography, spacing, colors, icons, or control appearance.

## 2. Core UX principles

1. **Edit directly.** Make an action a gesture wherever that gesture is understandable and practical.
2. **Keep context close.** Item-specific actions belong in context menus or inline controls, not a persistent property panel.
3. **Support discovery.** Visible add controls complement right-click actions. Creation hints introduce the less obvious gestures.
4. **Keep time precise.** Pointer movement can be continuous, but the resulting chart uses whole weeks.
5. **Make changes recoverable.** Undo restores a complete user action, including all bars displaced by a drag.
6. **Keep the app controls small.** The chart dominates the editor. Avoid growing the toolbar into a collection of every available command.

Small overlays are acceptable when they serve a specific interaction: choosing a calendar reference date, editing a color, or confirming deletion. Ordinary naming should happen inline.

## 3. Vocabulary and chart structure

| Term               | Meaning                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| Document           | The chart currently being edited. Persistence and document-management behavior are deferred.           |
| Section            | A named group of rows. It supplies an inherited color and can be collapsed or reordered as a unit.     |
| Row                | A named horizontal lane containing bars and milestones. It belongs to one section.                     |
| Bar                | A period occupying one or more whole weeks. It has an optional label and may have a custom color.      |
| Milestone          | A point marking the end of a particular week. It has an optional label and may have a custom color.    |
| Relative week      | An integer position on the timeline, such as Week −2, Week 0, or Week 3.                               |
| Calendar reference | A real date assigned to the beginning of one relative week. Other calendar labels are derived from it. |
| Color override     | An explicit item color that takes precedence over the section's inherited color.                       |

Sections and categories are the same concept for this version. There is no separate tagging or category system crossing section boundaries.

A row can contain several separate work periods. It does not need to correspond to a single task or a single uninterrupted bar. Committed bars in the same row cannot overlap, but they can be directly adjacent.

Moving a row between sections moves all of its contents. Moving a section moves all of its rows and their contents. These organizational changes preserve time positions.

## 4. Starting a document

A new document opens with:

- One unnamed section.
- One empty row within that section.
- A relative timeline whose fixed origin is Week 0.
- A short hint in the empty row: **“Drag to create a bar · Double-click for a milestone.”**

The hint disappears while any bar or milestone exists. It returns whenever the document has no bars or milestones, including after deleting every item or undoing the first creation. Show it once in the first visible empty row rather than in every empty row.

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

| Relative position | Starting date      |
| ----------------- | ------------------ |
| Week 0            | September 14, 2026 |
| Week 2            | September 28, 2026 |
| Week 3            | October 5, 2026    |
| Week 4            | October 12, 2026   |

The chosen date does not have to be a Monday. Each week is a seven-day period starting from the selected reference.

Calendar mode labels weeks by their starting dates. Bars still occupy whole weeks. Switching between relative and calendar displays preserves their positions and the calendar reference.

Selecting calendar mode before a reference exists opens a centered date-picker dialog with the same dimmed backdrop as deletion confirmation. Its custom calendar is visible immediately, with Monday-first weeks, month navigation and a Today shortcut beside the month controls; there is no separate selected-date field below the calendar. The selected date represents the start of Week 0. Choosing a day changes an uncommitted draft; **Set date** applies it. Cancel, Escape, or clicking the backdrop discards the draft and leaves relative-week mode selected. Selecting a week heading opens the same dialog to set or replace the date assigned to the start of that specific week; the remaining labels are derived in seven-day increments. Applying a reference from any entry point automatically selects Dates. The reference and display change are one undoable action; undo restores both previous values. Set date is disabled until a draft date is selected. The calendar initially shows the existing reference or today's month without selecting a default reference. Arrow keys navigate days, Home/End navigate within a week, and Page Up/Down navigate months. Dates in the chart use an English day–short-month–year format, for example **5 Oct 2026**; headings may put the year on a second line. The user chooses the date; the example is not a default reference.

Right-clicking a timeline heading opens a calendar-reference context menu. Without a reference, it offers **Set reference**. With a reference, it offers **Reset reference** and **Clear reference**. Set and Reset open the existing date picker for the clicked week, with Dates selected when the reference is applied. The draft remains uncommitted until Set date; cancellation preserves the reference and history. Clear removes the reference and switches to Weeks as one undoable action; undo restores both the previous reference and display mode. These actions preserve all item positions.

The toolbar's **Dates** button also opens the calendar-reference context menu on right-click, using Week 0 for Set and Reset. Clearing, history, draft cancellation, and focus restoration follow the same behavior as the timeline-heading menu.

App context menus are limited to chart targets (timeline headings, sections, rows, bars, milestones, and empty lanes) and the Dates toolbar button. Other surfaces, including the remaining toolbar controls, page margins, footer, inline text inputs, and dialogs, retain the browser's native context menu.

### 5.3 Milestone timing

A milestone created anywhere inside a week is placed at that week's **end**, visually at its right boundary.

In calendar mode, its meaning is the final date of that seven-day period. For a week beginning October 5, the milestone represents October 11, even though its visual boundary is shared with the beginning of the following week.

Dragging a milestone chooses the nearest week-ending boundary. It can also move between rows. A milestone may share a row and time region with a bar and does not participate in bar collisions. Initially, only one milestone may occupy a given week-ending boundary in a given row. A duplicate creation or drop is invalid and does not move the existing milestone.

## 6. Editor controls and navigation

### 6.1 Minimal toolbar

The agreed toolbar contains only:

- Undo.
- Redo.
- Zoom.
- Relative-week/calendar-date switch.

The document name is omitted. Item properties do not accumulate in this toolbar.

### 6.2 Navigation

| Input                     | Result                                 |
| ------------------------- | -------------------------------------- |
| Normal vertical scrolling | Move through rows and sections.        |
| Horizontal scrolling      | Move through time.                     |
| Space-drag                | Pan the chart.                         |
| Zoom control              | Change the amount of timeline visible. |
| Ctrl/Cmd + mouse wheel    | Zoom shortcut.                         |

Zoom changes the viewing scale, not the time precision: editing remains in whole weeks at every zoom level.

The zoom control is a custom dropdown with a nearby chevron that rotates while open, a marked current preset, and keyboard navigation. Arrow keys, Home, and End navigate presets; Enter or Space applies one. Escape or clicking outside dismisses it without changing zoom. Wheel zoom continues to show its current percentage even between presets.

Navigation must coexist with creation gestures. An ordinary drag in empty row space creates a bar; Space-drag is the distinct panning gesture.

The editor fills the available window width and height between its toolbar and footer. Scrolling stays inside the chart viewport. The timeline heading row stays fixed vertically, including the top-left corner, while section and row headings move vertically with their corresponding lanes. Content under the fixed header cannot receive pointer input. Horizontal scrolling moves only the timeline: week headings, grid lines, bars, and milestones. The section/row heading column, section names, row names, and their controls stay pinned on the left. They still move vertically with their corresponding rows and sections. Timeline content cannot paint or receive pointer input over that fixed column. This applies to ordinary horizontal scrolling, edge auto-scroll, and future panning.

At 100%, the timeline shows approximately 24 weeks (initially Week -2 through Week 21); 200% shows approximately 12 weeks and 12.5% approximately 192. A narrow window may show fewer weeks because the chart retains its minimum width. The zoom range is 12.5% to 200%. At widths below 60 CSS pixels per week, Dates displays aligned calendar month bands below a year band; month boundaries follow actual calendar dates even within a week. Clicking or right-clicking a month band uses the week under the pointer; keyboard activation uses the first visible whole-week start in the band. Weeks displays spaced week labels at a power-of-two stride sufficient to give each label at least 60 CSS pixels. Its individual heading cells and lane grid remain one week wide, including unlabeled heading cells; selecting an unlabeled cell assigns a reference to that specific week. Grid lines and editing retain whole-week precision. Ctrl/Cmd plus mouse-wheel zoom preserves the time under the pointer; toolbar zoom preserves the time at the viewport center. Exact zoom steps and wheel sensitivity remain tunable implementation details.

## 7. Creating and naming items

### 7.1 Creating a bar by dragging

1. Press in empty timeline space within a row.
2. Drag across the desired period.
3. Preview the resulting whole-week interval.
4. Release to create the bar.
5. Make its label editable inline.

Enter finishes naming. Escape skips naming while retaining the newly created bar. A label is optional. Dragging directly from the open bar-name input starts movement after 4 CSS pixels, committing any typed name first. A click without dragging keeps the editor open and places the caret. Creation, naming, and subsequent movement remain separate undoable actions.

Dragging leftward across an interval creates the same bar as dragging rightward across it. A press and release without a meaningful drag creates nothing, preserving double-click as the milestone gesture.

For the first slice, meaningful dragging begins at 4 CSS pixels of horizontal movement from the press position. Both drawing endpoints snap to the nearest week boundary, with exact halfway ties toward the later boundary. Once the threshold is reached, the result has a minimum duration of one week.

If the new interval conflicts with existing bars, they preview a cascading push to the right. Release commits the creation and the complete final push as one action. Escape during the unfinished drag, or an interrupted gesture such as loss of the active pointer, restores the pre-gesture state and creates no history entry.

### 7.2 Creating a bar through the context menu

Right-clicking a week within a row provides **“Add bar here.”** It creates a one-week bar at that row and week, pushing conflicting bars to the right under the same rules as drag creation, then starts inline naming. End handles can subsequently extend it.

The context menu must use the location where it was opened, even if choosing the command moves the pointer away from that location.

### 7.3 Creating a milestone

Double-clicking empty row space creates a milestone at the end of the clicked week and begins inline naming.

The context menu also provides **“Add milestone here.”** It uses the same placement rule.

### 7.4 Inline editing

Clicking anywhere in a section's name area edits its name in place. Double-clicking a row name, bar label, or milestone label edits that text in place. Row, section, and milestone menus offer **“Rename”**. A bar's context-menu heading contains its editable name directly, with an **“Unnamed bar”** placeholder when empty. Enter commits and dismisses the menu; focus loss commits; Escape discards the current name draft and dismisses the menu. Text undo remains native while the field is focused, and moving the pointer through menu actions does not steal its focus. Menu naming leaves the chart's zoom unchanged. Opening any name editor places the caret at the end of the existing text without selecting it.

Inline naming retains the label's typography, color, background, and position. Section, row, and milestone editors have no visible input box, border, or focus outline. Bar text is vertically centered in both display and editing modes. Bars and milestones gain no selection border or outline, and focusing the chart does not add an outline around it. Bar resize handles remain visible regardless of selection or hover when the painted bar is at least 32 CSS pixels wide. Smaller bars hide their handles and use a zoom-in cursor. Selection still determines keyboard deletion; invalid-drop feedback remains visible during gestures.

Dragging a label still moves its item; the label is not an area that blocks direct manipulation. The bar's inline name field shows the same grab-hand cursor as the bar body, including immediately after creation. Dedicated bar end handles remain resize targets. A valid snapped drop preview uses the item's effective color, including its explicit override or the destination section's inherited color. Invalid proposals retain their distinct warning outline and tint.

Display labels appear only when the painted bar is at least 56 CSS pixels wide; longer labels are clipped. The complete name and timing remain available on hover. During inline editing, the input stays within the bar; long text scrolls inside the field.

Clicking a bar narrower than 32 CSS pixels animates to 200% over approximately 150 ms, preserving the week under the pointer. It selects the bar without moving or resizing it. Creating or renaming a bar narrower than 56 CSS pixels uses the same animation while keeping the name input focused and bringing the full bar into view. At the resulting detail scale, resize handles are available. Escape, window blur, or manual wheel zoom interrupts the animation at its current view. Space-drag still pans over tiny bars. These view changes preserve document history and redo. A visible label remains part of the bar's drag target.

## 8. Selection, movement, and resizing

Only one item is selected at a time. There is no Shift-click multi-selection, selection rectangle, or grouped movement of independently selected items.

Clicking empty chart space clears selection. Right-clicking an item selects it before opening its context menu. A context menu opened over empty lane space retains the exact row and week at which it was opened. Collapsing a section clears the selection if the selected item becomes hidden.

Opening a context menu with the mouse focuses the menu without highlighting an action. Mouse movement and arrow keys share a single active action or color swatch; a stationary pointer does not override keyboard navigation. Moving away from the actions clears the pointer highlight. Arrow Down starts at the first action, Arrow Up at the last, and subsequent arrows wrap through actions and swatches. Enter activates the focused action; Escape dismisses the menu.

### 8.1 Bar movement

Dragging anywhere on the bar body moves it in time. It can also move to a different row. Its duration is preserved.

The dragged bar follows the pointer continuously. A subtle preview indicates the whole-week result. Releasing a valid proposal settles the bar onto that whole-week position; pending overlapping moves cancel under section 9's contact-delay rule.

When the pointer crosses rows, each hovered row previews the collision result that would follow a drop there. Leaving the row restores its committed arrangement. Only the destination row at pointer-up changes.

Entering a row establishes a fresh approach reference at the bar's entry interval. Movement within that row uses the same contact delay, directional pushing, and pass-through reordering as movement within the original row. If entry already overlaps a neighbor, entering on the neighbor's right pushes it left; entering on its left pushes it right. Compare the centers of the whole-week intervals to determine that side, with equal centers pushing right. When entry overlaps bars on both sides, each side pushes outward independently: the left neighbor and its chain move left, and the right neighbor and its chain move right. The inserted bar opens a gap between them, preserving their order. Those sides remain fixed during the activated push; moving away restores a cleared side, and moving back displaces it outward again. Speeding up to overtake either side releases the two-sided push and restores both chains. Subsequent contacts follow horizontal approach within the new row. Motion and contact in the departed row do not determine the new row's push direction.

### 8.2 Bar resizing

Dragging the left or right end handle changes the corresponding boundary. The result settles onto the nearest whole-week boundary.

The opposite boundary stays in place. Bars represent at least one whole week. A resize stops at that minimum; handles cannot cross or exchange roles. An exact halfway snapping tie resolves to the later week boundary.

### 8.3 Milestone movement

Dragging a milestone changes its week-ending position and can change its row. Its final location is the nearest week-ending boundary.

### 8.4 Reorganization on the left

Rows and section headings show a six-dot drag handle. Dragging the handle or name area moves the structure; clicking a handle alone does not open naming. Dragging a row's name area moves that entire row:

- To a different position within its section.
- Into another section.

Dragging a section heading reorders the section as a unit. Reordering rows or sections does not alter dates or relative weeks.

The dragged row or section remains attached to the pointer as one opaque visual object, above surrounding rows, grids, bars, and milestones, including all contents that move with it. A row's center crossing a neighboring row midpoint selects its insertion position. Section reordering uses the whole visible block (heading, expanded rows, and Add row control): its bottom edge crossing the next section's midpoint moves it down; its top edge crossing the previous section's midpoint moves it up. Collapsed sections use only their visible height. Surrounding content animates to show the proposed insertion point. Moving back reverses that preview; release commits the arrangement currently shown.

Hovering a dragged row over a collapsed section for a short delay, initially around half a second, temporarily expands that section with animation. Leaving collapses it again if it was originally collapsed. Cancelling restores the original collapse states. Dropping the row into the section leaves the destination expanded so the result remains visible.

## 9. Bar collisions and cascading pushes

### 9.1 Basic rule

Committed bars within the same row cannot overlap. Adjacency is valid: there is no required empty week between bars. Pending movement can visually overlap as described below.

If moving or extending a bar would overlap another, an activated push moves the other bar far enough to prevent overlap. Movement waits for the contact delay below; drawing and resizing push immediately. The pushed bar's duration is preserved. It is not shortened, clipped, or split.

If that displacement reaches another bar, the push cascades through the affected chain.

### Delayed pushing during bar movement

Moving a bar can pass through other bars and change their order. A push activates only after the whole-week drop proposal has continuously overlapped the same neighbor's committed interval for **300 ms**. The pointer may keep moving; it does not have to pause. Painted overlap alone does not start the delay. The duration is initially tunable around this agreed value.

Until activation, the dragged bar follows the pointer immediately and neighbors retain their committed positions. A distinct invalid-drop outline marks the overlapping bar and its snapped preview. Passing into a free interval before activation allows an ordinary valid drop, leaving every crossed neighbor unchanged. Passing before activation does not require crossing the speed threshold used to escape an active push.

Once a neighbor's delay expires, the complete collision cascade activates together in the approach direction and animates normally. Continuing to push carries that neighbor and its chain for any distance, including beyond their original intervals. Indirectly pushed bars do not each wait another 300 ms. Retracting brings the chain back with the dragged bar, restoring each neighbor as the proposal no longer requires its displacement. Retracting clear releases the push; returning begins a fresh delay. Contact with a different neighbor before activation has its own start time.

Push direction follows the approach into the current contact, rather than total displacement from pointer-down. Passing a neighbor before activation, reversing, and holding over it therefore pushes it from the other side after a fresh delay. An active push retains its approach direction while the pointer is stationary or retracts; the neighbor does not switch sides during that push.

To overtake after activation, speed up in the push direction above **1,000 CSS px/second**, initially tunable. This releases the push and animates the pushed bars back to their original positions while the dragged bar passes through. Fast retraction in the opposite direction does not release the push: it brings the chain back with the dragged bar at any speed. The threshold is strict; movement at exactly 1,000 px/second still pushes. Viewport scrolling is excluded from pointer speed.

Contact always uses the pre-gesture arrangement, including after overtaking. Speed above the threshold resets pending contact; slowing down or stopping over the same neighbor waits a fresh 300 ms. Painted animation never defines these intervals. A valid drop includes the final displacement in the same atomic move; an invalid drop, Escape, or interruption restores the complete document from pointer-down.

Releasing on a still-invalid overlapping proposal cancels the **entire move**, restores the pre-gesture arrangement, and creates no history entry. It does not silently push on release. A valid drop commits the displayed whole-week arrangement and every final displacement as one action. Release, Escape, pointer loss, and window interruption clear pending contact timers. Edge auto-scroll continues independently and can advance contact while the pointer stays still.

Drawing, resizing, and menu creation use immediate collision handling. Bar movement uses the contact delay and speed escape in every row. Changing rows clears active pushes and pending contact; entering or returning to an overlapping row starts a fresh 300 ms delay, using the entry-side rule under section 8.1. Speed in the departed row does not release or postpone this new contact.

### 9.2 Direction

- Moving horizontally to the right pushes conflicting bars right.
- Moving horizontally to the left pushes conflicting bars left.
- Extending the right boundary pushes bars on the right farther right.
- Extending the left boundary pushes bars on the left farther left.
- Moving into another row pushes conflicting destination bars in the approach direction after the contact delay, using the entry position as a fresh reference.

Pushing has no dependency or scheduling meaning. It is the editor's way of keeping bars accessible without overlap.

### 9.3 Example

Start with three adjacent bars:

| Bar | Occupied weeks | Duration |
| --- | -------------- | -------- |
| A   | 0–1            | 2 weeks  |
| B   | 2–3            | 2 weeks  |
| C   | 4              | 1 week   |

Extend A by one week:

| Bar | New occupied weeks | Duration |
| --- | ------------------ | -------- |
| A   | 0–2                | 3 weeks  |
| B   | 3–4                | 2 weeks  |
| C   | 5                  | 1 week   |

B moves one week right and pushes C one week right. Both preserve their original durations.

### 9.4 Preview displacement is reversible

Collision changes made during a gesture are reversible previews derived from the state at pointer-down. If the user drags back or shrinks A after it has pushed B and C, B and C flow back when the current snapped proposal no longer requires their displacement. A deliberate speed escape releases a movement push under section 9.1 and restores those original positions. The pointer-down document remains the cancellation and undo boundary.

Only a valid arrangement visible at pointer-up becomes committed. A pending overlapping move cancels on release as described above. Escape or an interrupted gesture restores the complete state from before pointer-down and creates no undo entry. Undo is used after a completed gesture to restore that pre-gesture state; redo reapplies the complete committed result.

### 9.5 Creation and milestones

Drawing or menu-creating a bar across existing bars pushes conflicting bars to the right, cascading as needed. Creation and all resulting displacement are one committed action.

Milestones are point markers rather than bars. They may appear within bars and do not participate in bar collision handling. The one-milestone-per-row-and-boundary rule is independent of bar overlap.

## 10. Motion and snapping

Smooth interaction is a core UX requirement, not a cosmetic enhancement to add later.

The system must combine two behaviors:

1. **Continuous visual tracking:** the manipulated item follows pointer motion without jumping from week to week.
2. **Whole-week results:** the preview and final result resolve to the nearest valid whole-week position or boundary.

Affected bars must visibly glide to their displaced positions. They should not teleport when a collision threshold is crossed. Cascading changes should remain readable as connected movements.

When the pointer is released, the manipulated item settles smoothly into its whole-week result. Animation must preserve the final non-overlap rule and the duration of every pushed bar.

The dragged bar, milestone, row, or section remains visually attached to the pointer without intentional animation delay. Surrounding content and final snapped settlement begin with a short transition of roughly 150 ms. Exact easing and per-operation timing remain tunable. Reduced-motion behavior is not required for the first milestone. Smoothness is not permission to introduce lag into direct pointer tracking.

Holding a dragged object near a viewport edge automatically scrolls the chart. Timeline operations scroll horizontally; cross-row and structural operations may scroll vertically. Scrolling stops immediately when the pointer leaves the edge zone or the gesture ends.

Horizontal edge scrolling begins after the drag reaches the 4 CSS px threshold. Each edge zone occupies 40 CSS px inside the visible timeline. Speed increases linearly from zero at the zone's inner boundary to 240 CSS px per second at the viewport edge. Holding the pointer still continues scrolling; the manipulated boundary or bar remains attached while its whole-week preview updates. Moving outside the chart stops scrolling. Release, Escape, and pointer/window interruption stop it immediately.

The initial Week −2 through Week 9 view is a viewport, not a document boundary. Edge scrolling reveals earlier or later weeks indefinitely without renumbering Week 0 or existing items. Scrolling is outside history, persists after gesture cancellation, and does not clear redo.

## 11. Sections, rows, and add controls

### 11.1 Visible creation controls

Each section contains an **“Add row”** icon or button after its last row. It is not attached to the section heading.

An **“Add section”** control appears below all sections, after the last row area of the final section.

These controls provide discovery and an alternative to right-clicking. Their final styling is deferred.

### 11.2 Context-menu structure actions

Right-clicking a section provides actions to add a row and add a section. A context-created section is inserted immediately after the section whose menu was opened.

Right-clicking a row provides insertion above or below. Rename, color-related actions, and deletion appear where applicable to the selected object.

New rows and sections store an empty name, display **“Unnamed row”** or **“Unnamed section”** as a placeholder, and immediately enter inline naming.

A newly added section starts empty. Its Add row control creates the first row when needed.

### 11.3 Collapse and expansion

A section can collapse to hide its rows and expand to reveal them again. Collapsing does not remove items or change their time positions.

Expansion and collapse are animated. The add-row control remains available for a collapsed section. Using it expands the section, creates the row, and begins inline naming. A section may remain empty after its last row is deleted.

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

Each color menu has four quick swatches (Peach, Lavender, Sea blue, Slate); its fifth slot opens a centered color-picker overlay with the same dimmed backdrop as date setup and deletion confirmation. The picker offers six coordinated hue families (peach, lavender, sea blue, sage, rose, slate), each in light, medium and deep shades. Choosing a swatch updates only the draft and its preview; Apply color commits one undoable color action. Cancel, Escape, or clicking the backdrop discards the draft and preserves redo. Focus returns to the chart on dismissal. Arrow keys navigate the six-column palette (left/right by one, up/down by six); Home/End choose the first/last shade, and Tab stays within the overlay. Inherited items open with their effective section color selected. Arbitrary custom-color entry remains deferred. Prototype design names do not appear in user-facing labels; the original warm default is named Peach.

## 13. Deletion and undo/redo

### 13.1 Confirmation

Deleting a row or section requires confirmation. The confirmation should make the scope understandable: a row deletion also removes its items; a section deletion also removes its rows and all their items.

Cancelling the confirmation leaves the chart unchanged. Confirmed deletion remains undoable. Rows and sections require confirmation even when empty.

Delete or Backspace removes a selected bar or milestone immediately and undoably. These shortcuts do not delete chart objects while the user is typing in an input.

### 13.2 Undo boundaries

Undo and redo must cover creation, movement, resizing, naming, recoloring, row and section reorganization, deletion, calendar-reference changes, and switching between relative-week and calendar-date displays.

A completed drag is one action even when it pushes several bars. Undo restores the complete state before that gesture, including every affected bar's position. Redo restores the complete resulting state.

For the collision example above, one undo returns A, B, and C to their original ranges. The user does not need to undo each push separately.

Creation and initial naming are separate actions. Creating an item commits one entry and opens its inline editor. Committing its initial name creates another entry. The first undo restores the empty name; the next removes the item and restores all displacement caused by its creation. Escape during initial naming keeps the item unnamed and creates no naming entry.

Renaming an existing object commits one action on Enter or focus loss. Escape restores the pre-edit name. While an inline editor is active, Ctrl/Cmd+Z belongs to text editing. Outside an editor, Ctrl/Cmd+Z undoes an editor action; Ctrl/Cmd+Shift+Z redoes, and Ctrl+Y also redoes on Windows.

Selection, scrolling, panning, zoom, open overlays, and ordinary section collapse/expansion are outside history. They do not clear redo. A new editor action after undo clears redo.

Undo and redo must reveal their result. If the affected content is inside a collapsed section, the section automatically expands with animation and the viewport scrolls enough to show the changed object when necessary. That automatic reveal is not a history action.

## 14. Acceptance scenarios

These are behavioral checks for the implementation. Every agreed interaction requires automated coverage before it is considered complete, using rule/state tests and scripted real-browser tests at the appropriate levels.

| Scenario                                                        | Expected result                                                                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Open a new document                                             | One unnamed section, one empty row, relative weeks, fixed Week 0, and a creation hint are visible.                  |
| Draw the first bar at Week 3                                    | It stays at Week 3; the origin is not reassigned.                                                                   |
| Add content before Week 0                                       | Negative weeks are available; existing items retain their relative positions.                                       |
| Drag across empty row space                                     | A whole-week bar is created and its label becomes editable inline.                                                  |
| Use “Add bar here”                                              | A one-week bar is created at the context-menu location.                                                             |
| Double-click empty space in Week 2                              | A milestone is created at the end of Week 2.                                                                        |
| Drag a bar by its label                                         | The bar moves; text does not block dragging.                                                                        |
| Pass a bar through neighbors before their contact delay expires | Dropping into free space changes bar order without moving crossed neighbors.                                        |
| Maintain snapped overlap with a neighbor for 300 ms             | The full collision cascade activates, including with a stationary pointer.                                          |
| Release a pending overlapping move                              | The entire move cancels, restoring the original arrangement and preserving history/redo.                            |
| Clear and return to a neighbor                                  | Its push reverses, and returning starts a fresh 300 ms contact delay.                                               |
| Continue an activated push beyond original neighbor positions   | The neighbor and its chain keep moving ahead for any distance.                                                      |
| Speed up forward above 1,000 CSS px/second after activation     | Pushed bars animate back to their original positions while the dragged bar overtakes.                               |
| Retract an activated push above 1,000 CSS px/second             | The chain moves back with the dragged bar; speed does not release the push.                                         |
| Overtake a neighbor, reverse, and hold over it                  | After a fresh delay, the neighbor pushes from the new approach side; holding still does not change that direction.  |
| Double-click the same label                                     | The label becomes editable in place.                                                                                |
| Resize into an adjacent bar                                     | The other bar moves without changing duration.                                                                      |
| Push into a chain of bars                                       | All necessary bars move smoothly; no final overlap remains.                                                         |
| Reverse a drag after pushing other bars                         | Pushed bars flow back when the current snapped proposal no longer conflicts with them.                              |
| Cancel a drag after previewing pushes                           | Every affected item returns to its pre-gesture state and no history entry is created.                               |
| Undo that completed drag                                        | All affected items return to their pre-gesture state in one undo.                                                   |
| Move a bar into an occupied row                                 | Fresh 300 ms contact pushes destination bars from the entry/approach side with durations preserved.                 |
| Enter a row, approach a neighbor from either side               | Pushing and pass-through reordering follow the approach in that row, independently of the original pickup position. |
| Drag a bar across several rows                                  | Each hovered row previews and reverses its pushes; only the row used at release is committed.                       |
| Move a row between sections                                     | Its items preserve their time positions and follow the color-inheritance rules.                                     |
| Reorder a section                                               | Its rows and items move together without changing time positions.                                                   |
| Hover a row over a collapsed section                            | The section opens after a short delay, closes again on leave, and remains open after a successful drop.             |
| Delete a populated section                                      | Confirmation explains the contents affected; cancellation changes nothing; confirmed deletion is undoable.          |
| Assign a calendar date to Week 3                                | All calendar labels follow that week-start reference at seven-day intervals.                                        |
| Switch back to relative weeks                                   | Positions and the calendar reference are preserved.                                                                 |
| Undo a hidden-content change                                    | The containing section expands and the changed content is revealed.                                                 |
| Delete every item                                               | The creation hint returns once in the first visible empty row.                                                      |
| Zoom or pan                                                     | Only the view changes; editing precision remains whole weeks.                                                       |
| Scroll horizontally                                             | Weeks and timeline items move; section/row names and controls stay pinned on the left.                              |

## 15. Keyboard scope for the first milestone

Keyboard operation covers standard controls, inline naming, deletion, cancellation, and undo/redo. Chart positioning, resizing, and structural movement remain drag-based initially. Menu-based numeric editing and direct arrow-key manipulation may be considered later; they are not part of this milestone.

## 16. Remaining details and deferred work

The interaction decisions required to begin implementation are settled. The following lower-level details remain intentionally tunable:

1. Exact zoom steps and wheel sensitivity within the agreed range.
2. Final animation easing and whether individual operations need timings different from the initial 150 ms value.
3. The precise collapsed-section hover delay around the initial half-second value.

Persistence, autosave, document reopening, export, a home screen, mobile interaction design, and desktop packaging remain outside the first implementation milestone. The first milestone is a working editor whose contents reset on refresh.
