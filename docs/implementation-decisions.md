# Takt implementation decisions

**Status:** Editor, browser project files/recovery, and Windows desktop implemented; section 17 records their shared architecture and automated acceptance.

**Last updated:** October 10, 2026.

**Related sources:** The [functional UX specification](ux-specification.md) is authoritative for product behavior. The [Apricot prototype](../ui-prototype/index.html) is the visual reference. This document records the technical direction, testing contract, implementation sequence, and interaction decisions made while preparing for implementation.

## 1. Completed editor milestone

The original first milestone proved the in-browser editor without persistence or Home. The current application remains statically deployable and adds the project-file, Home, recovery, and desktop behavior described in UX section 17. The implementation boundaries are recorded in section 17 below.

The milestone is intended to prove the editor itself: direct manipulation, reversible previews, collision handling, structural reordering, motion, inline editing, and complete undo/redo. Features outside that milestone can be designed around the working editor later.

The selected prototype supplies the visual direction: palette, typography, spacing, chart geometry, and component appearance. It is not production code. Its hard-coded chart, historical stylesheet layers, and CSS-only preview controls should not be copied wholesale. The document-name field shown in the prototype is omitted from the first implementation.

## 2. Application foundation

### Framework

Use **Svelte 5 with Vite and TypeScript**, rather than SvelteKit 3, for the first implementation.

The editor is currently one static, client-side screen. It does not need routing, server rendering, server actions, or other SvelteKit application conventions. Svelte provides the component and reactivity model, while Vite supplies the development and static build pipeline. This choice can be revisited if the application later gains requirements that benefit from an application framework.

### Repository shape

The browser application lives under `apps/web`. The agreed Windows milestone adds a sibling Tauri application under `apps/desktop`, sharing the editor and file format.

Keep platform file operations outside the shared editor and document lifecycle. The web milestone does not require a Tauri dependency or a speculative package hierarchy. Extract shared packages when the desktop consumer makes the useful boundary concrete; preserve one implementation of chart behavior and the file codec. Section 17 supersedes the original instruction to defer all desktop design.

### Supported environment

Target current desktop versions of Chrome/Edge, Firefox, and Safari with mouse or trackpad input. Mobile and tablet interaction design remain outside the first milestone.

Do not introduce virtualization or other performance architecture speculatively. A chart with roughly 200 rows is considered large for current product thinking, but it is not a formal benchmark or a reason to optimize before measurements show a problem.

## 3. Component and module strategy

Build the chart specifically for Takt. Its continuous pointer tracking, whole-week preview, reversible cascading collisions, cross-row movement, and transactional undo behavior are central product rules and are unlikely to fit a general Gantt library cleanly.

Build a custom Takt component library as the editor grows. Components should be extracted when a stable responsibility or repeated interaction becomes visible; completing an exhaustive component catalogue before integration is not a milestone.

The expected visual seams include:

- editor header and toolbar controls;
- chart viewport and timeline header;
- week cells, section headings, row labels, and lanes;
- bars, resize handles, milestones, drag previews, and drop indicators;
- add-row and add-section controls and the empty-document hint;
- context menus, menu items, color palettes, popovers, dialogs, and inline text editors.

Use custom Takt markup and styling for the chart. Established unstyled primitives may provide behavior for standard controls such as menus, dialogs, popovers, and tooltips when they integrate cleanly with Svelte and the required appearance. This avoids rebuilding ordinary focus, dismissal, and keyboard behavior while retaining full visual control.

Keep these concerns separate:

1. **Document rules:** sections, rows, items, time intervals, colors, calendar mapping, and invariants.
2. **Commands and history:** atomic committed changes, undo, redo, and reveal-on-history behavior.
3. **Gesture transaction:** the immutable state at pointer-down, current pointer proposal, reversible preview state, cancellation, and commit.
4. **Rendering:** Svelte components that display committed or preview state and animate between layouts.
5. **Viewport state:** selection, focus, scroll, zoom, pointer position, open overlays, and collapsed sections.

This separation is a testability requirement. Collision and history behavior must be exercisable without synthesizing browser pointer input, while browser tests must still prove that real pointer events drive those rules correctly.

The first slice places document invariants, collision rules, and atomic history commands in `apps/web/src/model`; pointer-independent transactions in `apps/web/src/interaction`; view-only state and coordinate conversion in `apps/web/src/viewport.ts`; and rendering/input adapters in `apps/web/src/components`. `Editor`'s initialization contract is documented near its history construction.

The cross-row slice adds explicit row IDs, an ordered row collection, and a separate milestone collection. Milestone boundaries store the start of the following week. The visible Add row command and its separate inline naming action make cross-row operations available in the production editor.

Render items in a stable keyed overlay across all lanes, clipping it at the timeline column. Changing an item's row must not remount its captured pointer surface or interrupt its settlement animation. Lane geometry supplies destination hit testing; the adapter tracks the carried item's painted vertical offset separately from its snapped row. Empty-lane menus retain their row/week at opening. Structural and item menus retain object identity for insertion, naming, recoloring, inheritance reset, and deletion.

The structural slice adds an ordered section collection and explicit section ownership on rows. Row order within a section comes from the ordered row collection; section movement preserves every row and item. `model/structure.ts` owns insertion, movement, and cascading container deletion. Empty sections and a document with no sections are valid; the bottom Add section control remains available. New sections start empty, as recorded in the UX specification.

`interaction/structure.ts` owns pointer-independent structural layout and transactions. All positions are relative to the chart body. Row centers cross neighboring row midpoints. Section movement compares the complete visible block's bottom or top edge with the next or previous section's midpoint, recomputing semantic slots after each crossing. This supports large jumps and reversal across unequal group heights without stationary-pointer oscillation. Hit testing uses semantic preview geometry rather than animated bounding boxes. The transaction retains original collapse state and a 500 ms hover deadline; the browser adapter schedules that deadline and supplies monotonic time. No browser timers enter the transaction.

Rows, section headings, and timeline items remain mounted in stable keyed overlays. Absolute positions animate for surrounding content and final settlement, while carried structures and their contents disable transitions. Stable DOM order prevents keyed reinsertion from interrupting CSS transitions. Structural pointer capture belongs to the stable viewport; the adapter preserves single-click section naming and double-click row naming. Painted pickup geometry preserves pointer attachment when an earlier layout transition is interrupted. Chart height and row heights animate collapse and expansion. Collapsed state stays outside history, including temporary hover expansion; history reveal uses destination layout coordinates while expansion is still animating.

Six-dot handles on row and section headings use the same structural transaction and stable viewport capture as name-area drags. Handle clicks suppress inline naming. Structural drags reuse vertical edge scrolling across the full chart, including the label column. Automatic scrolling stops at the semantic chart extent, so a carried object's overflow cannot continuously enlarge the scroll limit. Native confirmation dialogs provide modal focus containment, Escape cancellation, and a scoped contents count before a single atomic container deletion.

Structural coverage includes rule and transaction sequences, real pointer capture in all three browsers, midpoint reversal, collapsed hover deadlines, insertion and naming history, empty/populated confirmations, edge scrolling and reveal. Dedicated motion tests pause actual 150 ms transitions to inspect surrounding flow, reversal, settlement, expansion, and interrupted pickup. The production scenario combines these operations; visual baselines cover multiple sections, collapse, carried-row preview, and confirmation. Existing Apricot baselines gain the collapse and Add section controls.

## 4. Interaction transaction model

Carried structures have opaque surfaces in the clipped item overlay, above stationary items and below carried bars and milestones. Section surfaces cover the full visible group; row surfaces reproduce the weekly grid. Carried labels remain pinned above that overlay. The carried heading and interior row surfaces have no shadows. The final Add row strip supplies the shadow below the complete section group, clipped above the strip to avoid an interior seam. Valid item ghosts use the same effective color lookup as items, with the proposal row supplying inheritance.

`components/name-drag.ts` preserves native caret placement on clicks in a bar-name input, then hands the original press and current movement to the stable bar surface after the four-pixel threshold. Naming commits before the movement transaction captures its history boundary. Menu-heading naming uses a separate draft, shares the atomic name command, preserves native text shortcuts, and commits on outside presses in the capture phase before chart handlers can close the menu.

Every drag gesture has three conceptual states:

1. **Start:** capture the complete committed document state relevant to the gesture.
2. **Preview:** derive the proposed result from the start state and the current pointer. The dragged object follows the pointer continuously; snapped placement and all resulting displacement are previews.
3. **Commit or cancel:** pointer-up commits a valid result currently shown as one history action. An invalid pending overlapping move, Escape, or an interrupted gesture restores the start state and creates no history entry.

Preview changes are reversible. If a resize pushes neighboring bars and the pointer returns to the earlier size, those bars flow back to their original positions. If a dragged bar enters an occupied row, that row previews its collision pushes; when the bar leaves, the row returns to its committed state. Intermediate rows crossed during a drag are not modified on commit.

This rule supersedes the earlier UX-specification wording that displaced bars stayed pushed when the pointer reversed. Only the arrangement visible at pointer-up becomes durable.

The dragged object remains visibly attached to the pointer:

- a bar or milestone follows the pointer while its snapped destination remains legible;
- a row drag carries the row and its items as one object;
- a section drag carries the section and all its visible rows and items;
- surrounding bars, rows, and sections flow around the proposed destination;
- returning the pointer across a structural boundary reverses that preview;
- pointer-up must produce the valid arrangement that was visible immediately before release, or cancel a visibly invalid proposal.

Releasing outside the visible chart may commit when the current proposal is valid. Escape cancels an active drag. A genuine interruption such as losing the active pointer/window cancels and restores the start state.

When a bar is picked up during settlement or collision displacement, capture its displayed geometry for immediate pointer attachment. Keep the committed document as the transaction's history boundary. Movement preserves the committed duration, and resizing preserves the committed opposite boundary; displayed geometry never becomes fractional document data. Clip bars and snapped previews to the timeline lane so they cannot paint over the row-name column.

## 5. Bar creation, movement, resizing, and collisions

### Creation geometry

Dragging either left-to-right or right-to-left over the same weeks creates the same interval. A press and release without a meaningful drag creates nothing, preserving double-click as the milestone gesture.

A newly drawn bar that conflicts with existing bars is allowed. Conflicting bars are pushed to the right, cascading as needed and preserving every duration. The creation and all resulting pushes form one committed action.

The context-menu command **Add bar here** follows the same collision rule for its one-week bar and retains the row/week at which the menu was opened.

### Movement and cross-row preview

Moving a bar preserves its duration. Movement in every row pushes collisions in the current contact's approach direction, with row-entry behavior defined in UX section 8.1.

Bar movement gates pushes on 300 ms of continuous snapped contact in every row, as specified in UX section 9. Track contact start timestamps and approach direction by neighbor ID inside `Gesture`, using committed intervals. Its `update(pointer, time, speedPointer)` accepts a monotonic timestamp and a CSS pixel pointer coordinate explicitly; there are no timers or browser dependencies in the transaction or model rules. The pixel coordinate defaults to the week coordinate times the pickup scale for standalone sequences. The browser supplies client X so viewport motion cannot trigger the speed escape. The first matured current contact activates the complete `placeBar` cascade with a neighbor anchor and retained approach direction. When row-entry contacts mature on opposite sides, retain the innermost left and right anchors together. `placeBarBetween` partitions the committed row at the right anchor and resolves the two outward cascades independently. Keep both anchors until the push is released so clearing and returning to one side preserves the insertion order. Speed escape toward either anchored side releases both chains. The anchor keeps pushing beyond the neighbor's original interval; retraction recomputes displacement from the pointer-down document and releases the anchor when clear. Compare consecutive week proposals to capture a fresh approach. Total displacement from pointer-down gives the wrong direction after an overtake and reversal.

The speed escape is strictly above 1,000 CSS px/second, measured from consecutive timed updates. Fast continuation in the active push direction releases the anchor and restores the neighbors to their original positions. Fast retraction retains the anchor and unwinds the displacement normally. Fast movement resets pending contact. Equal timestamps do not establish a velocity. Every preview derives from the immutable `before` document; no displaced arrangement accumulates across updates or overtakes. A valid commit includes the final displacement atomically; an invalid commit restores `before`.

Keep `proposal` and `validDrop` separate from the always-valid `preview` document. During pending overlap, the proposal/painted tracking can overlap, while `preview` retains the committed arrangement. An invalid `commit()` returns the original document, creating no command and preserving redo. The browser adapter supplies `performance.now()`, schedules the pending deadline even without pointer movement, and clears/reschedules it after each proposal update. Native scroll and edge-scroll frames re-project the last pointer through the current viewport before updating contact; neither is a history action. End/cancel/unmount clear the deadline timer. Rendering marks pending bars and ghosts with an invalid outline and explanatory hover text.

While moving across rows, each hovered row may show its proposed collision result. Leaving that row restores it. Only the row in which the bar is released is changed.

Use the previous proposal row to detect row changes, including while a pending overlap leaves the preview at the pointer-down arrangement. A row change clears active pushes and pending contact and excludes prior-row velocity from overtaking. Filter contact neighbors by the current proposal row. Entry already overlapping a neighbor derives approach from the snapped interval centers (equal centers use right); later contact uses movement within that row. Leaving and re-entering any row starts fresh contact, retaining the same immutable pointer-down document as the history boundary. Drawing and resizing remain in their pressed row. Purely vertical bar or milestone movement reaches the gesture threshold after 4 CSS pixels.

### Resizing and snapping

The opposite boundary remains fixed during a resize. A bar has a minimum duration of one week; handles stop at that minimum and do not cross or exchange roles.

Pointer motion is continuous while the semantic result snaps to whole-week boundaries. An exact halfway tie resolves to the later week boundary. A snapped preview communicates the exact result that pointer-up will commit.

### Collision invariants

- Committed bars and document previews never overlap; direct adjacency is valid. Pending movement overlap exists only in separate presentation state.
- A pushed bar keeps its duration and is never shortened, split, or clipped.
- Pushes cascade through every bar needed to make the preview valid.
- Creation collisions push to the right.
- Moving right pushes right; moving left pushes left.
- Extending the right edge pushes right; extending the left edge pushes left.
- Cross-row movement uses fresh row-entry contact and the same directional delay, cascade, and overtaking rules as movement in the original row.
- Preview displacement reverses when the current pointer proposal no longer requires it.

## 6. Motion and auto-scrolling

Motion is functional feedback and part of the acceptance contract.

The manipulated object tracks the pointer immediately, without an intentional animation delay. Other affected content and the final snapped settlement use short transitions, initially around **150 ms**. Treat the exact timing and easing as tunable design values, but preserve the distinction between immediate tracking and animated surrounding response.

Section expansion and collapse are animated. When rows or sections reorder, surrounding structures visibly make space rather than teleporting.

Dragging near a viewport edge auto-scrolls:

- horizontally for timeline operations;
- vertically when changing rows or reorganizing rows and sections;
- continuously while the pointer remains in the edge zone;
- stopping immediately when the pointer leaves the edge zone or the gesture ends.

Reduced-motion behavior is not a requirement for this milestone.

Horizontal edge scrolling uses a fractional first-visible-week coordinate in viewport state and an animation-frame loop in the browser input adapter. Each frame re-projects the last client pointer into week coordinates before updating the transaction. Translate the timeline content as a whole so viewport motion cannot trigger bar settlement transitions; week headings and grid lines share the same view offset. Lane grids render a single SVG path with explicit one-week coordinates from `weekGridPath`; CSS gradient background tiling can restart at a fractional week and create an oversized cell, while fractional image tiles can lose lines in Firefox. Header buttons retain individual week widths independently of label stride. Painted pickup geometry includes that offset. The committed document remains the history boundary. Undo/redo reveal adjusts this view coordinate to show the affected interval (aligning its start when it is wider than the visible timeline).

Use a viewport-height grid shell with a flexible chart region between toolbar and footer. Keep the chart header vertically sticky above all content with an opaque background. Exclude its 54 px height from visible-row hints, edge-scroll zones and history reveal. `timeline-headings.ts` maps actual month/year boundaries to fractional week coordinates and chooses readable week-label strides; this presentation never changes document timing. Below 20 px per week, bar insets and handle widths shrink to preserve distinct resize targets. Keep the label column horizontally sticky with opaque section/row backgrounds above timeline content. The visible timeline's left edge excludes the pinned column even after native horizontal scrolling changes the lane's border box. Share its width between layout and input geometry through `LABEL_WIDTH`. Native scroll events re-project an active pointer so the bar stays attached; vertical navigation still carries labels with their corresponding content.

Browser edge-scroll tests advance an installed Playwright clock frame by frame while holding a real mouse pointer stationary. They verify both directions, drawing/movement/both handles, accelerating edge speed, pointer attachment without transitions, cancellation, preserved redo, and atomic commit. Ordinary first-slice motion tests continue to verify collision and settlement transitions.

Bar and milestone movement also uses a vertical edge velocity within the scrollable chart, initially using the horizontal 40 px/240 px-per-second tuning. Native and automatic vertical scrolling re-project the row under the pointer and compensate the carried item's vertical offset. Stop at scroll limits and on leaving the viewport or ending the gesture. Undo/redo reveal the affected row vertically as well as its time interval. Cross-row component tests cover intermediate-row restoration, duplicate milestone cancellation, both scroll directions, acceleration, pointer attachment, and reveal; focused motion tests inspect actual 150 ms push, restoration, and two-axis settlement transitions in all three browsers.

Delayed-push state tests cover exact activation boundaries, continuous movement, passing through, contact resets, different neighbors, invalid release/history preservation, and both cascade directions. Include sustained pushes beyond original intervals, strict speed boundaries, restoration on fast continuation, fast retraction, fresh contact after an escape, and stationary screen pointers during viewport motion. Real-browser tests use the installed clock for deadline activation without movement, directional speed escapes, timer cleanup on every gesture ending, and dwell while edge-scrolling. Motion tests inspect the existing 150 ms CSS transitions, including pushes after reversing an overtake, restoration on speed escape, and fast retraction. Include visual baselines for pending/activated overlap and horizontally scrolled pinned labels.

## 7. Rows, sections, and collapsed destinations

Rows reorder within a section and move between sections. Sections reorder as complete units. The preview changes when the dragged object crosses the relevant neighboring midpoint, and surrounding content animates to show the current insertion position. Moving the pointer back reverses the preview.

When a dragged row hovers over a collapsed section for a short delay, initially about half a second, that section temporarily expands. Leaving it during the same gesture collapses it again if it was originally collapsed. Cancelling restores every section's original collapsed state. Dropping the row into that section commits the row move and leaves the destination expanded so the result is visible.

The add-row control remains available for a collapsed section. Using it expands the section, adds the row, and starts inline naming.

A section created from another section's context menu is inserted immediately after the section whose menu was opened. New rows and sections have empty stored names, display **Unnamed row** or **Unnamed section** as placeholders, and immediately enter inline naming. A section may remain empty after its last row is deleted.

## 8. Milestones and labels

Milestones may occupy a boundary that falls visually within a bar and do not participate in bar collision handling.

Initially, only one milestone may occupy a given week-ending boundary in a given row. A move or creation that would duplicate that row/boundary is invalid. The preview must make that invalid result clear; release does not create a duplicate or displace the existing milestone.

Painted bars below 32 CSS pixels hide handles and use click-to-zoom; labels appear from 56 pixels. Long labels are clipped, with the full label and timing available on hover. Inline inputs stay within the bar and scroll long text. Tiny bars zoom into usable resize targets, and dragging by the visible label still moves the item.

## 9. Calendar mode, timeline, and zoom

The first view shows approximately Week −1 through Week 22 at 100%, with 24 weeks across the full timeline width. At 200% it shows 12 weeks; 12.5% shows 192. The timeline can extend in either direction without renumbering existing items.

Use a zoom range of 12.5% through 200%. Editing precision remains whole weeks at every zoom level. Ctrl/Cmd plus mouse-wheel zoom preserves the time under the pointer. Toolbar zoom preserves the time at the viewport center.

If the user selects **Dates** without a calendar reference, open the centered date-picker dialog with its calendar already visible and the shared dimmed backdrop. Its chosen date represents the start of Week 1. Cancelling the dialog leaves **Weeks** selected. Selecting a week heading opens the same dialog to set or replace the reference for that specific week; every other label is derived in seven-day increments.

Changing between Weeks and Dates is an undoable editor action. Calendar-reference changes are also undoable. Scrolling, panning, and zooming are view changes outside document history.

Document and interaction week coordinates remain zero-based; all user-facing relative week numbers add one, including date-dialog headings and timing tooltips. `timeline-headings.ts` shares UTC month/year band arithmetic between real calendar references and a synthetic January 1 of Year 1 for relative overview labels. Both modes retain the upper year band at every zoom and switch their lower tier from weeks to months below 60 CSS pixels per week, with short relative month labels when needed. Calendar constructors use setUTCFullYear to preserve years 0 through 99 and negative years. `model/calendar.ts` uses UTC date-only arithmetic for seven-day mapping and inclusive bar/milestone end dates, avoiding daylight-saving shifts. Documents optionally carry a week/date reference and display mode; omitted mode means Weeks. Every reference application commits the reference and Dates display together as one action; explicit display switches remain separate history entries. `CalendarPicker` renders a custom calendar grid with Today beside month navigation and no selected-date entry section inside the shared `Dialog` component. Native `showModal()` provides focus containment and Escape cancellation; the component provides optional backdrop dismissal. Calendar focus returns to the trigger after it is re-enabled. `calendar-grid.ts` handles UTC grid arithmetic, leap dates, month movement and supported-year bounds. `Button` supplies shared Apricot primary, secondary and destructive variants for date setup and deletion confirmation. The UX specification records the dialog interaction and chosen date format.

`Select` provides the custom zoom dropdown using the browser's auto popover top layer for outside dismissal and clipping independence. It owns option focus, keyboard navigation and trigger focus restoration. A 150 ms CSS transition rotates the nearby chevron. The new controls retain the app's palette and take visual inspiration from shadcn-svelte without adding its framework or dependencies. Browser coverage checks selection, dismissal, focus containment, calendar keyboard navigation and draft history; unit coverage checks date arithmetic. Visual baselines cover open zoom, calendar drafts and shared confirmation buttons, and a dedicated motion test samples the real chevron transition in both directions.

Zoom is a viewport multiplier over the default week width. Toolbar presets are 12.5%, 25%, 50%, 75%, 100%, 125%, 150%, and 200%; wheel zoom uses a clamped exponential scale and a non-passive native wheel listener. Coordinate conversion accounts for the native horizontal scroll offset when anchoring at the visible center or pointer. Headings render enough cells for the current zoom. Scale changes suppress item settlement transitions for two animation frames to keep the whole chart synchronized; panning translates timeline content immediately. Space-drag captures the stable viewport, retains the view on cancellation, and never starts a document transaction. Horizontal wheel input (including Shift-wheel) uses native overflow first, then changes the fractional first week to continue beyond either edge; normal vertical scrolling stays native. Zoom controls are disabled during document gestures so their pickup scale remains stable.

Compact-bar detail zoom uses a 150 ms requestAnimationFrame animation with logarithmic scale interpolation and cubic ease-out. Each frame recomputes the common week width and first week, retaining the pointer anchor; naming additionally interpolates the bar center into the visible timeline. Scale-change suppression prevents independent item settlement throughout this animation. Zoom is a view operation outside gesture transactions and history. Escape, wheel zoom, blur and destruction cancel its frame cleanly. Naming begins immediately and retains focus as the field grows, using preventScroll so native focus scrolling cannot disturb the shared anchor.

`model/colors.ts` resolves item overrides against the item's current row/section on every render. Missing section colors use the default Peach hue. `model/palette.ts` defines colors as finite numeric hues in [0, 360), with fixed OKLCH lightness 0.79 and chroma 0.085. Fill and matching dark ink are converted to sRGB at the shared appearance boundary; this range remains in sRGB across the hue circle. Named quick presets sample four hues from that range. Legacy semantic keys and shade variants are removed; no migration is required. `documentColors` derives a deduplicated palette from presets and committed section/item hues, so slider colors can be reused across targets and follow undo/redo. The palette wraps into rows of five. The swatches and a centered SVG plus lead to `ColorPicker`, which renders a native range input and bar/milestone draft preview inside the shared `Dialog`, using the date picker's header and action styling. The range stores tenths of a degree; keyboard steps are one degree or ten degrees, with Home/End endpoints. Apply commits to the retained target ID; cancellation preserves history and redo. Initial focus goes to the slider and Tab remains within the modal. Inheritance reset removes the override property. Moves preserve explicit overrides and dynamically adopt destination colors for inherited items. Section and item palettes share context-menu keyboard navigation; right-click selects the item, with direct bar-heading naming, milestone Rename, Use section color, and immediate item deletion commands. Continuous hue validation, full-circle lightness/chroma consistency and label contrast, pointer/keyboard selection, draft cancellation, inheritance, history and visual baselines have automated coverage.

Context menus use the same surface, rounding and shadow family as the custom zoom control, with target headings, grouped actions, labeled color swatches and destructive styling. `MenuItem` owns the repeated action-row appearance and decorative icons; editor callbacks still own commands and retained target identity. Opening measures the rendered menu before clamping it to an eight-pixel viewport inset, replacing guessed per-menu heights, then focuses the menu itself. Mouse pointer movement transfers focus to the action or swatch under it; action backgrounds depend on focus alone, following shadcn-svelte/Bits UI's shared pointer and keyboard highlight. Pointer departure clears focus back to the menu when using the mouse. Arrow navigation visits actions and palette swatches in DOM order, with explicit first/last entry from the menu container. Browser coverage verifies edge placement, focus across groups and mouse/keyboard handoff with a stationary pointer; visual baselines cover timeline, row, section, bar and milestone menus.

The `CalendarColors` fixture exposes nonzero calendar anchoring, two section colors, inherited bars/milestones, and an override. Coverage includes rule arithmetic and history, three-browser date setup and dismissal, anchored zoom after native scrolling, editing at both zoom limits, Space-pan cancellation and pointer attachment, cross-section inheritance, menu keyboard behavior, production integration, and screenshots for calendar labels, palette, date setup, and minimum zoom.

## 10. Selection, naming, deletion, and shortcuts

Clicking empty chart space clears selection. Right-clicking an item selects it before opening its context menu. A context menu opened over empty lane space records and retains the exact row and week to which its commands apply.

If collapsing a section hides the selected item, selection clears. Collapsing and expanding sections are viewport actions outside undo history.

### Naming and text history

Creation and initial naming are separate actions:

- creating an item commits one history entry and opens its inline editor;
- committing a non-empty initial name creates a second history entry;
- the first undo after creation and naming restores the empty name;
- the next undo removes the created item and restores every bar displaced by its creation;
- Escape during initial naming leaves the created item unnamed and creates no naming entry.

Renaming an existing object commits one naming action on Enter or when focus moves away. Escape restores the pre-edit name and creates no history entry.

While an inline text editor is active, Ctrl/Cmd+Z applies to editing within that input. Outside an editor, Ctrl/Cmd+Z undoes an editor action. Ctrl/Cmd+Shift+Z redoes, and **Ctrl+Y must also redo on Windows**.

### Deletion

Delete or Backspace removes a selected bar or milestone immediately and undoably. These shortcuts do not delete chart objects while the user is typing in an input.

Deleting a row or section always requires confirmation, including when it is empty. The confirmation explains the affected contents for populated containers. A confirmed deletion is one undoable action; cancellation changes nothing.

## 11. Undo, redo, and revealing results

History covers:

- bar and milestone creation;
- movement and resizing;
- naming;
- recoloring and inheritance changes;
- row and section creation, movement, and deletion;
- calendar references;
- switching between Weeks and Dates;
- confirmed deletions and all collision displacement caused by an action.

One completed drag is one history action, regardless of how many bars, rows, or sections moved in its final result. A new editor action after undo clears the redo stack.

Selection, scrolling, panning, zoom, open overlays, and ordinary collapse/expansion are outside history. These viewport changes do not clear redo.

Undo or redo must make its result observable. If an action changes content inside a currently collapsed section, that section automatically expands with animation. When necessary, the viewport scrolls enough to reveal the affected object. This automatic reveal is not itself added to history.

## 12. Empty-document hint

Show the creation hint whenever the entire document has no bars or milestones, including after deleting all items or undoing the first creation. Show it once in the first visible empty row rather than repeating it in every row.

## 13. Keyboard scope

The first milestone provides keyboard operation for standard controls, inline naming, deletion, gesture cancellation, and undo/redo. Chart positioning, resizing, and structural movement remain drag-based initially.

Menu-based numeric editing and direct arrow-key manipulation may be considered later. They are not part of the first milestone and should not complicate the initial gesture engine.

## 14. Automated verification contract

Every agreed interaction needs automated coverage before it is considered complete. The test suite replaces routine manual or LLM-driven browser regression passes.

Use complementary layers:

### TypeScript rule tests

Exercise interval arithmetic, snapping, date mapping, color inheritance, collision cascades, structural commands, history boundaries, and invariants without a browser. Include generated or table-driven cases where they materially expand edge-case coverage.

### Gesture state-transition tests

Exercise pointer proposals as deterministic sequences: start, move, enter another row, reverse, cancel, and commit. Assert both preview state and committed history. In particular, cover extend -> push -> retract -> neighbors return -> release, plus the corresponding undo and redo.

### Real-browser component tests

Use a real browser for pointer capture, actual layout geometry, focus, double-click, inline editors, menus, resize handles, edge auto-scroll, and Svelte component integration. Component stories or equivalent fixtures should expose named, reviewable states.

The first slice's named fixtures live in `apps/web/tests/fixtures` and render production components through the development server. They are excluded from the production entry. Browser tests use actual `page.mouse` input and layout geometry; forced interruption events are limited to cancellation paths.

### Integrated Playwright tests

Keep a focused end-to-end suite for complete editor scenarios and cross-component behavior. Script pointer movement directly; these are deterministic automated browser tests, not browser-control sessions performed by an LLM.

### Visual and motion checks

Use screenshot comparisons for stable visual states from the selected prototype and focused tests for motion-sensitive behavior. Ordinary behavioral tests may disable transitions for speed and determinism. Dedicated motion tests verify immediate pointer attachment, animated displacement rather than teleporting, reversible preview movement, and correct final settlement.

Motion tests inspect actual CSS transitions and pause them at intermediate times so scheduling delays cannot hide the animation. Behavioral assertions also check settled bounding boxes. Include pickups during animation; waiting for every bar to settle before a drag would miss interrupted-motion defects.

Automation can prove specified behavior and regression safety. Initial visual baselines and subjective interaction quality still require deliberate human design judgment when they are established or intentionally changed; they do not create a recurring manual regression checklist.

## 15. Implementation sequence

1. Create `apps/web` with Svelte 5, Vite, TypeScript, formatting/type-checking, and the layered test infrastructure. Extract the visual tokens and only the minimum shared components required by the first slice.
2. Build a complete difficult slice around bars in one row: creation, separate naming, movement, resizing, snapped preview, reversible cascading pushes, cancellation, commit, undo, redo, and motion.
3. Extend the gesture transaction to cross-row movement, temporary row previews, edge auto-scroll, milestones, and their invalid duplicate state.
4. Add structural row and section reordering, delayed expansion of collapsed destinations, animated layout flow, insertion commands, and destructive confirmations.
5. Add calendar setup and mapping, Weeks/Dates history behavior, zoom and panning, colors and inheritance, remaining menus, and full acceptance coverage.
6. Reconcile the implementation against every acceptance scenario in the UX specification and keep `AGENTS.md` current with the actual commands and repository conventions introduced during the work.

All six steps are implemented. The [acceptance reconciliation](acceptance-coverage.md) maps every UX scenario and the additional interaction contracts to their automated rule, browser, production, visual, and motion coverage. It also records the final history-reveal correction for objects removed by undo/redo. Reveal locations use command snapshots when the primary object no longer exists, without selecting a different item or adding viewport changes to history. The existing concise `AGENTS.md` remains current.

## 16. Details still intentionally open

The discussion resolved the interaction gaps required to start implementation, but a few lower-level choices remain deliberately tunable or deferred:

- the exact zoom step and wheel sensitivity within the agreed range;
- final animation easing and whether timings differ by operation;
- the precise collapsed-section hover delay around the initial half-second value;
- the concrete unstyled primitive library, if any, after evaluating current Svelte support;
- future wire-format migrations and additional Windows targets, when a demonstrated requirement justifies them.

These choices must not silently change the agreed interaction semantics. Record a product decision in the UX specification when a remaining choice affects observable behavior; record implementation-only choices near the code or in an appropriate architectural note.

## 17. Project files and desktop implementation

**Decision date:** October 10, 2026. **Status:** implemented; see the acceptance reconciliation for automated coverage. Product behavior is authoritative in [UX section 17](ux-specification.md#17-project-files-home-and-desktop). The [file-format document](takt-file-format.md) records the frozen v1 wire contract and schema. The [orchestrator handoff](project-files-orchestrator-handoff.md) is the execution entry point.

### 17.1 Boundaries

Keep these responsibilities separate:

| Responsibility      | Contract                                                                                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Portable file codec | Pure encode/decode/validation of versioned `.takt` bytes and persisted content/view. No file paths, browser APIs, or Tauri dependencies.                                |
| Document session    | Active document, title, persisted view, saved-content baseline, modified state, pending New/Open/close transitions, and recovery coordination.                          |
| Editor              | Existing chart commands, history, gestures, and view rendering. Publishes committed edits and settled view snapshots; file actions must not serialize gesture previews. |
| Application UI      | Home, header/title, File menu, replacement/conflict/recovery dialogs, and recents. Calls the session contract.                                                          |
| Browser adapter     | Local file input, download, and browser-local recovery storage.                                                                                                         |
| Desktop adapter     | Native dialogs, file reads/writes, file revision checks, application-data recovery/recents, and platform lifecycle hooks.                                               |

These are module responsibilities, not a mandate for a particular class hierarchy or directory layout. The orchestrator chooses concrete interfaces before workers depend on them and records those choices locally. Share the editor, codec, and lifecycle; isolate the actual platform differences at the adapter boundary.

Current integration points: `apps/web/src/main.ts` mounts `Editor` directly; `components/Editor.svelte` seeds its history from `initial` once and documents remounting to open another document. Introduce the application shell and an explicit session/editor boundary without routing file operations through the gesture engine. Keep exactly one owner for edits to `Editor.svelte` during concurrent work.

### 17.2 Persistence and modification tracking

Model saved content separately from persisted view. A content baseline includes the title and semantic chart fields, including the calendar and display mode; zoom, scrolling, and collapse state are excluded from dirty comparison. Comparing content to the saved baseline allows undo back to the saved content to become clean. A save captures both content and view, but only acknowledges the snapshot actually written: edits arriving during an asynchronous write remain modified.

Decode external input from `unknown`, validate structure and semantic invariants, and only then replace a live session. `model/document.ts:assertDocument` validates internal invariants; it is not a complete decoder for arbitrary JSON. Validate IDs/references, ordered collections, integer intervals, nonoverlap, milestone uniqueness, dates, colors, and view values. Existing editor-generated IDs must remain collision-free after opening an arbitrary valid file.

Recovery is a separate, versioned local record containing the portable snapshot plus session/platform metadata such as original path, revision token, saved baseline, and recovery time. Paths and recents never enter the portable `.takt` document. Use browser-local storage appropriate for structured records (IndexedDB is the recommended implementation) and the platform's per-user application-data directory on desktop. Recovery failure and multi-instance policies follow UX section 17.10.

The implementation freezes the shared portable boundary in `apps/web/src/project/format.ts` (`ProjectSnapshot`, `ProjectView`, encode/decode, and content comparison), and the asynchronous platform boundary in `project/platform.ts`. Platform operations distinguish success, cancellation, failure, and save conflict. The shared application accepts a platform adapter; desktop must reuse that application and editor rather than implement a second chart or lifecycle. UX section 17.10 records the lifecycle choices made under the user's explicit authorization to use best judgment.

Browser recovery uses versioned records in localStorage, with per-tab identity in sessionStorage and held Web Locks for recovery-record ownership. A live tab's record is copied; an abandoned tab's record is claimed under the original ID so deliberate discard removes it. Locks have no background-timer expiry and are released on page exit or removal. This is a deliberate refinement of the IndexedDB recommendation: synchronous storage writes provide a clear completed-storage boundary before replacement or navigation, without a pending database transaction at page unload. Storage or ownership APIs can be unavailable, or storage can exceed its quota; failures produce the UX warning and Retry, and explicit downloads remain available. Serve the browser app over HTTPS or localhost for the secure-context ownership API. Recovery is best-effort local data, not a promise of unlimited storage or a filesystem save.

Desktop recovery uses process-held operating-system locks in per-user app data. A record held by another live process is copied to a separate ID when recovered; an abandoned record is claimed under its original ID so deliberate discard removes that recovery permanently. Process termination releases ownership without timer leases or PID-reuse heuristics. Native tests include terminating a child process and then claiming its record. Explicit file saves use a SHA-256 revision, a flushed temporary sibling, a final revision check before Windows replacement, and readback of the installed bytes. A separate writer can still change the file between the final check and replacement; this is detection, not a distributed lock on project files.

External week coordinates and the effective first-week view are bounded to ±1,000,000. Merely accepting any finite value is unsafe: values outside JavaScript's date range can crash calendar rendering or prevent timeline-band iteration from terminating. Imported snapshots strip unknown fields and preserve ordered semantic collections; unsupported versions are rejected rather than partially imported.

Cancellation, stale asynchronous completions, and write failures must not replace a newer document, clear newer edits, or advance a pending close/switch. Serialize or identify session operations so results apply only to their originating document. Persist committed data, not live pointer previews, temporary hover-expanded sections, or uncommitted dialog drafts. Define how inline title/item edits finish and active gestures are handled when file commands are invoked.

Desktop writes should replace a complete file safely, preserving the last valid file on failed writes. Check revisions immediately before writing and after successful saves; timestamp-only detection can miss changes. Choose a suitable content fingerprint/revision strategy and test both local and shared-folder failure paths. External-change detection is not a distributed file lock; document remaining concurrent-writer limitations.

### 17.3 Delivery and orchestration

Implement the web milestone first, beginning with one integrated New → edit → Download → Open round trip. Add recovery and the full shell around that functioning path. Build desktop against the established interfaces in the second milestone, adding `apps/desktop` without forking editor behavior.

Use an orchestrator and focused workers. Workers choose implementation details within assigned interfaces and file ownership; the orchestrator owns product semantics, shared contracts, integration, and final acceptance. Each worker owns its tests. A separate review can inspect an integrated result; it does not substitute for automated acceptance. Parallelize only tasks whose interfaces are stable and whose file ownership does not overlap. Schedule shared-file changes explicitly and preserve other contributors' work.

The required desktop artifact is an unbundled executable with embedded frontend assets, not merely an installer. Tauri's [`build --no-bundle`](https://v2.tauri.app/distribute/) and [unbundled executable distribution](https://github.com/tauri-apps/tauri-action#inputs) support this direction. The Windows WebView2 dependency and delivery caveats are explained in the [research note](research/project-files-and-desktop.md). Confirm the supported environment before claiming release readiness.

### 17.4 Acceptance extensions

File drops stay outside the chart interaction engine. The shared shell handles browser `DataTransfer` events, suppresses file navigation, and uses an enter/leave depth counter for stable highlighting across nested elements. `PlatformAdapter.openFile` reads dropped browser `File` objects through the same codec used by the picker; optional `onFileDrop` forwards native enter/drop/leave events and paths. Desktop subscribes to [Tauri Webview drag/drop events](https://v2.tauri.app/reference/javascript/api/namespacewebview/#ondragdropevent), retains native drag/drop handling, and opens dropped paths through its existing native adapter to preserve file identity. Both sources flow through the same asynchronous Open/guard logic. Modal or busy states reject new drops; subscription disposal handles late registration without duplicate cleanup. Drop feedback appears immediately without adding transitions.

The shared shell keeps title and File controls in separate optional editor snippets: the title occupies the center header column, and File renders inside the right-hand toolbar. The Home logo button sizes to its content so empty grid space cannot navigate. File reuses `MenuItem` for icons, shortcut hints, and focus styling; pointer movement and keyboard navigation share a single focused action. Its chevron uses the same 150 ms transition as Zoom. Home uses a responsive Start/continue layout with compact project rows and decorative CSS timeline marks, preserving the platform/session boundaries.

Retain the four existing test layers and the root check sequence. Extend coverage rather than relaxing editor baselines or replacing pointer/motion acceptance with mocked internals.

- **Codec/rules:** round trips, negative weeks and boundary semantics, inherited/overridden colors, reordered/empty structure, invalid shapes and references, version handling, and title/content-versus-view dirty comparison.
- **Session/adapters:** cancellation/failure, asynchronous save races, invalid-open preservation, recovery lifecycle, complete recent-history retention beyond ten, missing files, and external revisions. Use deterministic adapters for these state sequences.
- **Real browsers:** Home/editor transitions, title and File menu, keyboard shortcuts, actual file input/download payload, refresh/recovery, and replacement dialogs in supported browsers. Browser storage/download limitations must be exercised according to the resolved UX policy.
- **Visual/motion:** Apricot Home/header/menu/dialog states and any new transitions, while retaining existing editor screenshots and motion checks. Baseline changes require deliberate design review.
- **Production integration:** real exported bytes reopen correctly; the former production assertion that refresh resets everything must change to the agreed Home/recovery flow, without losing its editor-default checks.
- **Desktop:** add automated native file/dialog/lifecycle and real filesystem checks as needed, plus a packaged executable launch test on the declared Windows/WebView2 target. Mocked adapters alone do not establish EXE acceptance. Record reproducible commands in README and the coverage reconciliation.

Update [acceptance coverage](acceptance-coverage.md) with actual test references when implemented. Keep planned cases separate from completed coverage and report any unverified desktop packaging or platform behavior explicitly.
