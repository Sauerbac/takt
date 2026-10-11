# Takt

Takt is a desktop web app for creating Gantt charts through direct manipulation: drag to draw and adjust bars, place milestones, organize rows into sections, and edit labels inline.

The name is German; the interface is English. The first version focuses on creating charts without sign-in. It is a chart editor, not a project-management system.

## Product documentation

The [UX specification](docs/ux-specification.md) records the agreed behavior, detailed examples, acceptance criteria, and intentionally tunable details.

The [implementation decisions](docs/implementation-decisions.md) record the selected Svelte/Vite foundation, component and interaction architecture, automated testing contract, and implementation sequence.

Project files, Home, and draft recovery extend the shared editor, with a Windows Tauri application in `apps/desktop`. The [orchestrator handoff](docs/project-files-orchestrator-handoff.md) records the delivery plan; [UX section 17](docs/ux-specification.md#17-project-files-home-and-desktop) defines behavior and the [`.takt` format](docs/takt-file-format.md) defines the portable file contract. See the desktop commands below for building and verifying the direct executable.

The fixed timeline origin is **Week 1**. Time is measured in whole weeks, with an optional calendar-date display anchored to a selected week.

## Selected UI design

The application follows the [Takt design system](https://claude.ai/artifact/K1y9MSi2FfLWuh9ihQPUHh): Geist, neutral zinc greys, and apricot `#b35d35` as the single primary color. Its tokens live in `apps/web/src/tokens.css`; UX specification section 18 records the direction and implementation decisions section 18 the component mapping. Geist is bundled through `@fontsource-variable/geist`, so the desktop build needs no network.

The earlier [Apricot prototype](ui-prototype/index.html) is superseded and kept for reference; its [guide](ui-prototype/README.md) describes it.

The production logo uses the **Stagger** mark: three offset horizontal Gantt bars in Apricot. `apps/web/src/assets/takt-mark.svg` supplies the header mark; `takt-icon.svg` adds a soft cream tile for the favicon. Both keep a fixed light palette. `apps/web/public/favicon.ico` includes 16, 32, and 48 px browser fallbacks, and `apps/web/public/app-icon.png` is a 512 px rendering for future desktop packaging.

After editing `takt-icon.svg`, run `npm run generate:icons` from the root to regenerate the ICO and PNG using the installed Playwright Chromium browser.

The complete design exploration is preserved in [archive/ui-prototypes](archive/ui-prototypes/README.md), including all earlier directions, palette galleries, comparisons, research, and authoring scripts. `ui-prototype/` holds the last prototype before the design system.

## Browser application

The browser app lives in `apps/web`, built with Svelte 5, Vite, and TypeScript. It supports drawing, inline naming, moving and resizing bars in one row, reversible collision previews, cancellation, and atomic undo/redo. Moving waits 300 ms of continuous snapped contact before pushing, allowing passage through neighbors to change their order; an early overlapping drop cancels. Activated pushes continue for any distance. Moving forward above 1,000 CSS px/second allows overtaking and restores the pushed bars to their original positions; retraction brings the chain back with the dragged bar at any speed. Drawing and resizing still push immediately. Horizontal edge auto-scroll reveals earlier and later weeks during those gestures, with speed increasing toward each edge. Section/row labels stay pinned horizontally. Week 1 remains fixed and viewport changes stay outside history. Refresh returns to Home, where locally retained work is available through Resume draft.

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

The calendar/navigation/color slice adds user-selected week-start dates, the undoable Weeks/Dates switch, zoom from 12.5% to 200%, Ctrl/Cmd-wheel zoom, Space-drag panning, and horizontal wheel navigation. Calendar mapping keeps seven-day periods stable across daylight-saving changes. Click a week heading to assign a date to that week; choosing Dates without a reference asks for Week 1's start. Milestone tooltips show the final date of their week. Zoom preserves time at the pointer or visible center, and view navigation preserves redo.

Right-click sections, bars, or milestones to choose a quick color; the centered plus opens a continuous muted hue picker inspired by the date dialog with a draft preview and Apply color action. Items inherit their section unless overridden; Use section color removes the override. Inherited items adopt destination colors when an item or row moves between sections. Bar menus edit the name directly in their heading; milestone menus provide Rename. Both offer undoable deletion. New bars can be dragged directly from their open name input, committing any typed name before movement. Carried rows and sections have opaque surfaces above surrounding items; section reorder thresholds use their full visible group. Snapped previews follow effective item colors. The additional `?state=CalendarColors` fixture exposes these states. Automated coverage includes date/color rules and history, real-browser controls and menus in all three browsers, motion/cancellation checks, production integration, and visual comparisons.

The first implementation milestone is complete. The [acceptance reconciliation](docs/acceptance-coverage.md) maps every UX acceptance scenario and the additional interaction contracts to automated coverage. History also reveals the affected location when undo removes a newly created object or redo deletes one, expanding and scrolling its surviving context without selecting another item. The `TallEmpty` fixture covers the hint following the first visible empty row. Project files, browser recovery, and desktop packaging are covered by the additional milestone below; arbitrary custom color appearance remains deferred. Reference setup always switches to Dates atomically; the calendar has a Today shortcut beside month navigation. Rows and sections show six-dot drag handles.

The editor fills the window between the header and footer; undo/redo, zoom, and Weeks/Dates float in a toolbar over the bottom of the chart. Timeline headings stay fixed vertically; section and row labels stay pinned horizontally. Dates keeps years above its date or month labels at every zoom. Weeks also keeps years on top and switches from week labels to relative month bands at the same zoom threshold, starting Week 1, Month 1 and Year 1 together with calendar-length months and years. The weekly grid and editing precision remain unchanged. Slider-picked hues appear in every color menu while used in the chart. Carried sections show a single shadow beneath the complete group. Browser context menus remain available outside chart targets and the Dates button, and inside text fields and dialogs. Reference menus are available on timeline headings and the Dates toolbar button; Dates uses Week 1.

Zoom uses 24 weeks across the full timeline at 100%, 12 at 200%, and 192 at 12.5%. The `ShortBars` fixture shows separated and adjacent one-week bars plus mixed durations. The selected compact-bar behavior is B: hide unreadable labels, click tiny bars to animate to 200% in 150 ms, then edit with normal drag handles. Tiny-bar creation and renaming also zoom for readable inline naming. The A/B/C comparison is preserved on local branch `codex/compact-bars-prototypes-2026-10-05`; the fixture now renders the production behavior.

## Project files and Windows desktop

Drop one `.takt` file onto Home or the editor to open it. Home's Open .takt file card is the drop zone and opens the picker when clicked. Drops use the same validation and unsaved-change guard as Open; multiple files and other extensions show a message without replacing work. Desktop keeps the dropped file's original save path and revision, while browser drops open an editable copy for downloading.

Launch opens Home: an apricot panel with New project and the Open .takt file card, beside the current project, recovery, and recent lists. New project opens the existing empty editor; Open reads a local `.takt` file. The editable title is centred in the header as a raised field with a pencil and a dot for unsaved changes; its tooltip names the file; Save (Download on web) and File sit on the right. The logo returns Home. Zoom, scrolling, and collapse are saved with the chart but do not mark it modified. Opening starts fresh chart history; returning to browser Home retains the current editor and its history.

In the browser, Ctrl/Cmd+S downloads a copy rather than overwriting the opened file. A successfully dispatched download clears the indicator for the captured content; Takt cannot verify that the browser retained it on disk. Download and continue requires explicit acknowledgement before replacement. Local draft recovery remains available on Home after refresh. Recovery uses browser-local storage, can fail or be cleared by the browser/user, and reports failures with Retry. Separate tabs keep separate records. Recovering a live tab's draft creates a copy; an abandoned draft is claimed so Discard removes it. Recovery ownership uses Web Locks: serve over HTTPS or localhost, and use the current supported desktop browsers. If storage or ownership is unavailable, the warning explains that recovery is unavailable while file operations remain usable.

Desktop shares the application, editor, codec, and session with the browser. It uses native Open/Save/Save As, ordinary user-selected paths, SHA-256 external-change checks, safe file replacement, full retained recent-file history, and per-user app-data recovery. Save As switches the active path. Removing a recent entry never deletes a project. Save conflicts offer Reload, Save another file, Overwrite, and Cancel; the check cannot eliminate a writer race between checking and replacing a shared file.

The initial executable target is **Windows 11 x64 with Microsoft Edge WebView2 Evergreen Runtime installed**. The EXE includes its frontend and runs directly without installing Takt. It is not a self-contained WebView2 distribution. Startup failures show a native prerequisite/error message. Other Windows versions/architectures, signing, installers, associations, and updates are outside this acceptance target.

Build prerequisites: Node.js 22.12+, npm, Rust with the MSVC x64 toolchain, Visual Studio C++ build tools and Windows SDK, and WebView2. Use the root lockfile and `apps/desktop/src-tauri/Cargo.lock` for reproducible dependencies. From the repository root:

```sh
npm ci
npm run format:check
npm run check
npm run build
npm test
npm run desktop:test
npm run desktop:build
npm run desktop:test:launch
```

`npm run check` checks both frontend workspaces; `npm run build` builds both frontend bundles. `npm test` runs the four browser/editor layers. `desktop:test` adds native filesystem and adapter checks, `desktop:build` produces an unbundled release executable, and `desktop:test:launch` starts that EXE against isolated acceptance data and checks rendered Home/editor plus real native file, recovery, recents, and conflict operations. The launch check requires an interactive Windows session and WebView2. Native build/test may require sandbox escalation for Cargo caches, compiler processes, and dependency downloads.

The direct artifact is `apps/desktop/src-tauri/target/release/takt.exe`. Keep its embedded frontend current by rebuilding the EXE after shared UI changes. Close a window launched from this output before rebuilding it; Windows prevents replacing an executable in use. Use `npm run desktop:dev` for the native development window. Desktop project data stays at chosen paths; application data normally lives in `%APPDATA%/de.takt.editor`, not beside the EXE.
