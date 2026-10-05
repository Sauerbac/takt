# Takt

Takt is a desktop web app for creating Gantt charts through direct manipulation: drag to draw and adjust bars, place milestones, organize rows into sections, and edit labels inline.

The name is German; the interface is English. The first version focuses on creating charts without sign-in. It is a chart editor, not a project-management system.

## Product documentation

The [UX specification](docs/ux-specification.md) records the agreed behavior, detailed examples, acceptance criteria, and intentionally tunable details.

The [implementation decisions](docs/implementation-decisions.md) record the selected Svelte/Vite foundation, component and interaction architecture, automated testing contract, and implementation sequence.

The fixed timeline origin is **Week 0**. Time is measured in whole weeks, with an optional calendar-date display anchored to a selected week.

## Selected UI design

[Apricot is the selected UI prototype](ui-prototype/index.html) and the basis for further refinement. It combines the Takt logo, file-name specimen, and toolbar in one header, removes the redundant “7 DAYS” labels, and removes the section-heading divider. The Apricot, lavender, and sea-blue palette retains the refined Swiss Grid typography and chart geometry. The file-name specimen is not part of the first implementation milestone.

Open the prototype directly in a browser; no installation or JavaScript is required. The [prototype guide](ui-prototype/README.md) records the selected direction, available preview controls, and implementation limits.

The complete design exploration is preserved in [archive/ui-prototypes](archive/ui-prototypes/README.md), including all earlier directions, palette galleries, comparisons, research, and authoring scripts. There is one active design in `ui-prototype/`.

## Browser application

The browser app lives in `apps/web`, built with Svelte 5, Vite, and TypeScript. It supports drawing, inline naming, moving and resizing bars in one row, reversible collision previews, cancellation, and atomic undo/redo. Moving waits 300 ms of continuous snapped contact before pushing, allowing passage through neighbors to change their order; an early overlapping drop cancels. Activated pushes continue for any distance. Moving forward above 1,000 CSS px/second allows overtaking and restores the pushed bars to their original positions; retraction brings the chain back with the dragged bar at any speed. Drawing and resizing still push immediately. Horizontal edge auto-scroll reveals earlier and later weeks during those gestures, with speed increasing toward each edge. Section/row labels stay pinned horizontally. Week 0 remains fixed and viewport changes stay outside history. Contents reset on refresh.

Use Node.js 22.12+ and npm. From the repository root:

```sh
npm ci
npx playwright install chromium firefox webkit
npm run dev
```

Validate with `npm run format:check`, `npm run check`, `npm run build`, then `npm test`.

### Development commands

Run these commands from the repository root; `apps/web` is the `@takt/web` npm workspace. Commit the root `package-lock.json`.

| Command                                                                                 | Purpose                                                                      |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `npm ci`                                                                                | Install the locked dependencies.                                             |
| `npx playwright install chromium firefox webkit`                                        | Install browser binaries after dependency installation.                      |
| `npm run dev`                                                                           | Start the browser app at Vite's printed local URL.                           |
| `npm run build`                                                                         | Generate the static application in `apps/web/dist`.                          |
| `npm run preview`                                                                       | Serve the production build locally.                                          |
| `npm run format`                                                                        | Format maintained source and documentation with Prettier.                    |
| `npm run format:check`                                                                  | Check formatting; archived and prototype files are excluded.                 |
| `npm run check`                                                                         | Run Svelte diagnostics and strict TypeScript checks.                         |
| `npm run test:rules`                                                                    | Run deterministic document, gesture, and history tests in Vitest.            |
| `npm run test:components`                                                               | Run component interaction and motion tests in Chromium, Firefox, and WebKit. |
| `npm run test:e2e`                                                                      | Run the integrated pointer scenario against the production build.            |
| `npm run test:visual`                                                                   | Compare Apricot component screenshots in Chromium.                           |
| `npm test`                                                                              | Run all four test layers; build first.                                       |
| `npm exec --workspace @takt/web -- playwright test --project=visual --update-snapshots` | Deliberately regenerate visual baselines after a reviewed appearance change. |

Build before running browser tests: Playwright starts the development server on port 5173 and the production preview on port 4173. Both ports must be available, or already serve this checkout. Browser installation and test execution may need sandbox escalation on Windows; Vite's config loader reads ancestor directories outside the checkout.

Screenshot baselines are Chromium/Windows-specific. Keep their browser version consistent with `package-lock.json`. Baseline updates require deliberate design review; screenshot assertions are the recurring acceptance mechanism.

### Component fixtures

Component fixtures are available through the development server at `/tests/fixtures/index.html?state=Empty`, `?state=Chain`, `?state=Narrow`, `?state=Separated`, and `?state=EdgeContact`. The last two expose separated collision destinations and sustained contact during edge scrolling. They render the same production components with deterministic initial data, and are excluded from the static production entry.

The cross-row slice adds an undoable Add row control with inline naming, bar movement between rows with reversible destination cascades, and milestones. Each row entry resets contact: the same 300 ms delay, approach direction, pass-through reordering, and speed escape apply in every row. Entry already overlapping a bar chooses its side from the whole-week interval centers, with equal centers pushing right. Inserting between overlapping neighbors opens space on both sides, with independent outward cascades. Double-click empty lane space to create a milestone at the end of that week, or right-click empty lane space for Add bar here / Add milestone here. Milestones move horizontally and between rows without pushing bars. Duplicate milestone placements show invalid feedback and leave history unchanged. Bar and milestone drags scroll vertically at chart edges; undo/redo reveal the affected row and interval.

The additional `?state=CrossRows`, `?state=RowEntry`, `?state=BetweenBars`, and `?state=Tall` fixtures expose cross-row cascades, approach direction after row entry, two-sided insertion, milestone conflicts, and vertical edge scrolling. Automated coverage includes rule/state sequences, all three browsers, actual motion transitions, production integration, and screenshot comparisons.

The structural slice adds section creation, per-section Add row controls, insertion menus, row reordering and movement between sections, section reordering, animated collapse/expansion, and confirmed row/section deletion. New sections start empty. Hovering a row over a collapsed destination for 500 ms temporarily expands it; leaving or cancelling restores its original collapse state, while dropping leaves the destination expanded. Whole rows and sections carry their contents without changing time positions. Structural gestures scroll vertically at chart edges and commit as one undo action. History reveals hidden content by expanding and scrolling to its destination.

The additional `?state=Sections` and `?state=TallSections` fixtures expose structural flow, empty sections, confirmations, and scrolling. Automated motion checks cover immediate attachment, neighboring flow, reversible movement, settlement, collapse, expansion, and pickup during animation. Native modal dialogs confirm every row/section deletion, including empty containers.

The calendar/navigation/color slice adds user-selected week-start dates, the undoable Weeks/Dates switch, zoom from 12.5% to 200%, Ctrl/Cmd-wheel zoom, Space-drag panning, and horizontal wheel navigation. Calendar mapping keeps seven-day periods stable across daylight-saving changes. Click a week heading to assign a date to that week; choosing Dates without a reference asks for Week 0's start. Milestone tooltips show the final date of their week. Zoom preserves time at the pointer or visible center, and view navigation preserves redo.

Right-click sections, bars, or milestones to choose a quick color; the fifth swatch opens a palette of eighteen coordinated shades with a draft preview and Apply color action. Items inherit their section unless overridden; Use section color removes the override. Inherited items adopt destination colors when an item or row moves between sections. Item menus also provide Rename and undoable deletion. The additional `?state=CalendarColors` fixture exposes these states. Automated coverage includes date/color rules and history, real-browser controls and menus in all three browsers, motion/cancellation checks, production integration, and visual comparisons.

The first implementation milestone is complete. The [acceptance reconciliation](docs/acceptance-coverage.md) maps every UX acceptance scenario and the additional interaction contracts to automated coverage. History also reveals the affected location when undo removes a newly created object or redo deletes one, expanding and scrolling its surviving context without selecting another item. The `TallEmpty` fixture covers the hint following the first visible empty row. Persistence, export, arbitrary custom colors, and desktop packaging remain deferred. Reference setup always switches to Dates atomically; the calendar has a Today shortcut beside month navigation. Rows and sections show six-dot drag handles.

The editor fills the window between the toolbar and footer. Timeline headings stay fixed vertically; section and row labels stay pinned horizontally. Overview zoom uses month/year bands in Dates and spaced labels in Weeks while retaining weekly grid and editing precision. Browser context menus remain available outside chart targets and inside text fields and dialogs. Reference menus are available on timeline headings.

Zoom uses 24 weeks across the full timeline at 100%, 12 at 200%, and 192 at 12.5%. The `ShortBars` fixture shows separated and adjacent one-week bars plus mixed durations. The selected compact-bar behavior is B: hide unreadable labels, click tiny bars to animate to 200% in 150 ms, then edit with normal drag handles. Tiny-bar creation and renaming also zoom for readable inline naming. The A/B/C comparison is preserved on local branch `codex/compact-bars-prototypes-2026-10-05`; the fixture now renders the production behavior.
