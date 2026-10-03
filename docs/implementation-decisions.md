# Takt implementation decisions

**Status:** Agreed direction for the first implementation milestone.

**Last updated:** October 3, 2026.

**Related sources:** The [functional UX specification](ux-specification.md) is authoritative for product behavior. The [Apricot prototype](../ui-prototype/index.html) is the visual reference. This document records the technical direction, testing contract, implementation sequence, and interaction decisions made while preparing for implementation.

## 1. First milestone

The first milestone is a working in-browser editor that implements the behavior in the UX specification. It is statically deployable and opens directly into the editor. It does not save its contents across refreshes and does not include document management, persistence, accounts, export, or a home screen.

The milestone is intended to prove the editor itself: direct manipulation, reversible previews, collision handling, structural reordering, motion, inline editing, and complete undo/redo. Features outside that milestone can be designed around the working editor later.

The selected prototype supplies the visual direction: palette, typography, spacing, chart geometry, and component appearance. It is not production code. Its hard-coded chart, historical stylesheet layers, and CSS-only preview controls should not be copied wholesale. The document-name field shown in the prototype is omitted from the first implementation.

## 2. Application foundation

### Framework

Use **Svelte 5 with Vite and TypeScript**, rather than SvelteKit 3, for the first implementation.

The editor is currently one static, client-side screen. It does not need routing, server rendering, server actions, or other SvelteKit application conventions. Svelte provides the component and reactivity model, while Vite supplies the development and static build pipeline. This choice can be revisited if the application later gains requirements that benefit from an application framework.

### Repository shape

Place the browser application under `apps/web`. Keep the repository shape capable of accepting a future sibling desktop application, such as `apps/desktop`, without implementing or designing around Tauri now.

The future desktop possibility should affect only this high-level placement. It must not introduce a premature shared-package structure, desktop abstractions, Tauri APIs, or constraints on the web implementation. Extract shared packages only when a real second consumer exists and the useful boundary is known.

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

## 4. Interaction transaction model

Every drag gesture has three conceptual states:

1. **Start:** capture the complete committed document state relevant to the gesture.
2. **Preview:** derive the proposed result from the start state and the current pointer. The dragged object follows the pointer continuously; snapped placement and all resulting displacement are previews.
3. **Commit or cancel:** pointer-up commits exactly the result currently shown as one history action. Escape or an interrupted gesture restores the start state and creates no history entry.

Preview changes are reversible. If a resize pushes neighboring bars and the pointer returns to the earlier size, those bars flow back to their original positions. If a dragged bar enters an occupied row, that row previews its collision pushes; when the bar leaves, the row returns to its committed state. Intermediate rows crossed during a drag are not modified on commit.

This rule supersedes the earlier UX-specification wording that displaced bars stayed pushed when the pointer reversed. Only the arrangement visible at pointer-up becomes durable.

The dragged object remains visibly attached to the pointer:

- a bar or milestone follows the pointer while its snapped destination remains legible;
- a row drag carries the row and its items as one object;
- a section drag carries the section and all its visible rows and items;
- surrounding bars, rows, and sections flow around the proposed destination;
- returning the pointer across a structural boundary reverses that preview;
- pointer-up must produce the arrangement that was visible immediately before release.

Releasing outside the visible chart may commit when the current proposal is valid. Escape cancels an active drag. A genuine interruption such as losing the active pointer/window cancels and restores the start state.

## 5. Bar creation, movement, resizing, and collisions

### Creation geometry

Dragging either left-to-right or right-to-left over the same weeks creates the same interval. A press and release without a meaningful drag creates nothing, preserving double-click as the milestone gesture.

A newly drawn bar that conflicts with existing bars is allowed. Conflicting bars are pushed to the right, cascading as needed and preserving every duration. The creation and all resulting pushes form one committed action.

The context-menu command **Add bar here** follows the same collision rule for its one-week bar and retains the row/week at which the menu was opened.

### Movement and cross-row preview

Moving a bar preserves its duration. Horizontal movement pushes collisions in the movement direction. Dropping into another row pushes conflicting destination bars to the right.

While moving across rows, each hovered row may show its proposed collision result. Leaving that row restores it. Only the row in which the bar is released is changed.

### Resizing and snapping

The opposite boundary remains fixed during a resize. A bar has a minimum duration of one week; handles stop at that minimum and do not cross or exchange roles.

Pointer motion is continuous while the semantic result snaps to whole-week boundaries. An exact halfway tie resolves to the later week boundary. A snapped preview communicates the exact result that pointer-up will commit.

### Collision invariants

- Bars in a row never overlap; direct adjacency is valid.
- A pushed bar keeps its duration and is never shortened, split, or clipped.
- Pushes cascade through every bar needed to make the preview valid.
- Creation collisions push to the right.
- Moving right pushes right; moving left pushes left.
- Extending the right edge pushes right; extending the left edge pushes left.
- Cross-row drops push destination conflicts to the right.
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

## 7. Rows, sections, and collapsed destinations

Rows reorder within a section and move between sections. Sections reorder as complete units. The preview changes when the dragged object crosses the relevant neighboring midpoint, and surrounding content animates to show the current insertion position. Moving the pointer back reverses the preview.

When a dragged row hovers over a collapsed section for a short delay, initially about half a second, that section temporarily expands. Leaving it during the same gesture collapses it again if it was originally collapsed. Cancelling restores every section's original collapsed state. Dropping the row into that section commits the row move and leaves the destination expanded so the result is visible.

The add-row control remains available for a collapsed section. Using it expands the section, adds the row, and starts inline naming.

A section created from another section's context menu is inserted immediately after the section whose menu was opened. New rows and sections have empty stored names, display **Unnamed row** or **Unnamed section** as placeholders, and immediately enter inline naming. A section may remain empty after its last row is deleted.

## 8. Milestones and labels

Milestones may occupy a boundary that falls visually within a bar and do not participate in bar collision handling.

Initially, only one milestone may occupy a given week-ending boundary in a given row. A move or creation that would duplicate that row/boundary is invalid. The preview must make that invalid result clear; release does not create a duplicate or displace the existing milestone.

Long display labels are clipped to the available item width, with the full label available on hover. During inline editing, the input may extend beyond a narrow bar. One-week bars must retain usable resize targets, and dragging by the visible label still moves the item.

## 9. Calendar mode, timeline, and zoom

The first view shows approximately Week -2 through Week 9 at the prototype's default week width. The timeline can extend in either direction without renumbering existing items.

Use an initial zoom range of roughly 50% through 200%. Editing precision remains whole weeks at every zoom level. Ctrl/Cmd plus mouse-wheel zoom preserves the time under the pointer. Toolbar zoom preserves the time at the viewport center.

If the user selects **Dates** without a calendar reference, open a compact date-picker popover. Its chosen date represents the start of Week 0. Cancelling the popover leaves **Weeks** selected. Once a reference exists, selecting a week heading can set or replace the reference for that specific week; every other label is derived in seven-day increments.

Changing between Weeks and Dates is an undoable editor action. Calendar-reference changes are also undoable. Scrolling, panning, and zooming are view changes outside document history.

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

### Integrated Playwright tests

Keep a focused end-to-end suite for complete editor scenarios and cross-component behavior. Script pointer movement directly; these are deterministic automated browser tests, not browser-control sessions performed by an LLM.

### Visual and motion checks

Use screenshot comparisons for stable visual states from the selected prototype and focused tests for motion-sensitive behavior. Ordinary behavioral tests may disable transitions for speed and determinism. Dedicated motion tests verify immediate pointer attachment, animated displacement rather than teleporting, reversible preview movement, and correct final settlement.

Automation can prove specified behavior and regression safety. Initial visual baselines and subjective interaction quality still require deliberate human design judgment when they are established or intentionally changed; they do not create a recurring manual regression checklist.

## 15. Implementation sequence

1. Create `apps/web` with Svelte 5, Vite, TypeScript, formatting/type-checking, and the layered test infrastructure. Extract the visual tokens and only the minimum shared components required by the first slice.
2. Build a complete difficult slice around bars in one row: creation, separate naming, movement, resizing, snapped preview, reversible cascading pushes, cancellation, commit, undo, redo, and motion.
3. Extend the gesture transaction to cross-row movement, temporary row previews, edge auto-scroll, milestones, and their invalid duplicate state.
4. Add structural row and section reordering, delayed expansion of collapsed destinations, animated layout flow, insertion commands, and destructive confirmations.
5. Add calendar setup and mapping, Weeks/Dates history behavior, zoom and panning, colors and inheritance, remaining menus, and full acceptance coverage.
6. Reconcile the implementation against every acceptance scenario in the UX specification and keep `AGENTS.md` current with the actual commands and repository conventions introduced during the work.

## 16. Details still intentionally open

The discussion resolved the interaction gaps required to start implementation, but a few lower-level choices remain deliberately tunable or deferred:

- the exact calendar date display format;
- the exact zoom step and wheel sensitivity within the agreed range;
- final animation easing and whether timings differ by operation;
- the precise collapsed-section hover delay around the initial half-second value;
- whether the first palette supports arbitrary custom-color entry in addition to its fixed colors;
- the concrete unstyled primitive library, if any, after evaluating current Svelte support;
- persistence, document management, export, a home screen, and desktop packaging.

These choices must not silently change the agreed interaction semantics. Record a product decision in the UX specification when a remaining choice affects observable behavior; record implementation-only choices near the code or in an appropriate architectural note.
