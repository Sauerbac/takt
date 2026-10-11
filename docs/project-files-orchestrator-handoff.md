# Project files and desktop: orchestrator handoff

**Prepared:** October 10, 2026. **Status:** implemented in the subsequent execution session. This document preserves the original delivery plan; section 8 records the result. The documentation session itself did not execute implementation.

## 1. Objective and reading order

Build project-file and document-management functionality around the existing Takt editor, preserving its interaction behavior and Apricot UI. Deliver browser persistence first and a Windows Tauri application second. Act as the orchestrator: assign focused implementation work, integrate it, and own final acceptance.

Read before dispatching workers:

1. [AGENTS.md](../AGENTS.md): repository rules and required checks.
2. [UX specification](ux-specification.md), especially section 17: agreed product behavior and remaining questions. Earlier sections remain authoritative for chart behavior.
3. [Implementation decisions](implementation-decisions.md), especially sections 3–4, 14, and 17: editor boundaries, gesture/history invariants, testing, and the new architecture.
4. [Proposed `.takt` contract](takt-file-format.md): fields, coordinate semantics, validation, and versioning. Concrete wire details are proposed, not an already shipped compatibility contract.
5. [README](../README.md) and [acceptance coverage](acceptance-coverage.md): environment, commands, and current regression coverage.
6. Apricot prototype guide (`ui-prototype/README.md` under the tag `archive/design-exploration`) for new UI; [format/desktop research](research/project-files-and-desktop.md) for platform integration.

Keep user-observable behavior in the UX specification and technical contracts in their designated documents. This handoff is a work plan, not a competing source of product rules.

## 2. Decisions that must survive the handoff

- Keep the chart-editor scope. Reuse the editor and preserve its direct interactions and visual design.
- `.takt` is native versioned JSON with one chart, editable title, and saved view state. Other applications' formats are not required.
- Web opens local files and downloads edited copies. Local drafts provide recovery; there is no browser recent-file library in this milestone.
- Desktop opens and explicitly saves ordinary files at user-chosen paths. The user explicitly chose this over authoritative projects in an app-managed library.
- Desktop app data holds recents/recovery/settings, not beside the EXE. The EXE must run directly without requiring installation of Takt.
- Home appears at launch. The logo returns Home; title and a compact File menu join the header. Chart controls remain together.
- One active chart per tab/window, no internal document tabs. Navigation alone does not create modified state.
- Desktop initially shows ten recent files, expandable to the full retained history. Ten is not the retention cap. Missing entries offer Locate, Remove from recents, and Cancel; removing an entry never deletes the file.
- Failed/cancelled operations preserve unsaved work. Recovery never silently saves over the desktop project file. Explicit discard removes its associated recovery.
- Desktop Save detects external changes and offers the agreed conflict choices. Shared files do not imply live collaboration or automatic merging.
- Two milestones: web first, then Tauri in `apps/desktop`, sharing editor and format.

Exact labels, transition outcomes, and acceptance scenarios are in UX section 17; workers must read them rather than extrapolate from this summary.

## 3. First actions

1. Inspect the checkout, working-tree changes, and applicable instructions. Preserve unrelated work. This documentation session found an existing untracked `docs/research/agent-guide-review.md`; it is not part of this feature. Do not sweep untracked research into a commit blindly.
2. Resolve [UX section 17.10](ux-specification.md#1710-product-details-still-requiring-resolution) before implementing the affected behavior. Ask independent questions together, continue unaffected work, and record answers in the UX specification. Keep settled decisions settled.
3. Freeze the codec/session interfaces: v1 schema and fixtures, content-versus-view snapshots, platform-operation outcomes (success/cancel/failure/conflict), and editor commit/view hooks. Refine illustrative wire details technically while preserving agreed semantics.
4. Assign actual files/modules before concurrent changes, including one owner for shared-file integration.
5. Implement the integrated web round trip before independent extensions.

The orchestrator may make routine technical choices. Unresolved product choices, such as treating a download request as confirmed storage or making title editing undoable, are not worker discretion.

## 4. Current integration points

| Location                                          | Relevance                                                                                                                                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/main.ts`                            | Mounts Editor directly; Home/session need an application shell.                                                                                                                                         |
| `apps/web/src/components/Editor.svelte`           | Owns history, chart state, input adapters, header, and view. `initial` seeds history once; opening another document needs a new instance or deliberately revised boundary. Assign one writer at a time. |
| `apps/web/src/model/document.ts`                  | Document types/invariants, but no title, file envelope, or arbitrary-JSON decoder. Loaded IDs must not collide with subsequently generated IDs.                                                         |
| `apps/web/src/model/history.ts`                   | Preserve atomic chart commands and fresh history on reopening.                                                                                                                                          |
| `apps/web/src/model/calendar.ts` and `palette.ts` | Zero-based weeks, date-only arithmetic, and numeric hue semantics.                                                                                                                                      |
| `apps/web/src/viewport.ts`                        | Zoom/first-week model; native scrolling and collapsed sections also live in Editor. Save the effective view, not just this object.                                                                      |
| `apps/web/src/components`                         | Reusable Apricot controls, dialogs, menus, and icons.                                                                                                                                                   |
| `apps/web/tests/fixtures`                         | Keep editor fixtures focused while production gains Home.                                                                                                                                               |
| `apps/web/tests/e2e/acceptance.spec.ts`           | Replace the obsolete refresh-resets-everything expectation with Home/recovery while preserving its editor-default checks.                                                                               |
| Root `package.json` / `package-lock.json`         | npm workspace and dependencies; add desktop commands when implemented.                                                                                                                                  |

Guard against serializing drag previews, losing inline edits at Save, remounting on every session update, clearing edits made during async saving, applying stale Open results to a newer session, treating navigation as dirty, deleting recovery before replacement succeeds, truncating recents to ten, or introducing platform APIs into the codec/gesture engine.

## 5. Agent ownership and autonomy

Use a small team sized to independent work and available slots. These roles are scheduled as needed, not all simultaneously.

| Role                           | Ownership                                                                               | Required result                                                            |
| ------------------------------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Orchestrator/integrator        | Product semantics, shared interfaces, shared-file scheduling, integration, final checks | Coherent implementation, current specs/coverage, verified milestone report |
| Document worker                | Codec, schema/fixtures, validation, format tests                                        | Safe decoding and semantic round trips aligned with the frozen contract    |
| Lifecycle worker               | Session transitions, saved baseline, recovery orchestration, adapters/state tests       | Deterministic cancellation/failure/conflict behavior and race handling     |
| UI worker                      | Home, title/header, File menu, recovery/recents UI, browser/visual tests                | Apricot UI connected to the session contract with automated coverage       |
| Desktop worker (milestone two) | `apps/desktop`, native adapters, packaging/desktop tests                                | Direct EXE, verified native lifecycle, platform documentation              |
| Reviewer (after integration)   | Read-only cross-module/spec review                                                      | Actionable findings with evidence; fixes return to their owners            |

Each assignment needs source links, fixed interfaces, actual allowed files, acceptance cases, and a completion condition. Tell workers they are not alone in the codebase: preserve others' edits and coordinate interface changes through the orchestrator. Implementers own their tests and report files changed, commands/results, and limitations.

Workers choose algorithms, helpers, and test organization inside their boundaries. Shared API changes, cross-workstream dependencies, product changes, and edits to another owner's files go through the orchestrator. Schedule writes to Editor, root configuration/lockfiles, and authoritative specs explicitly. Separate worktrees can isolate changes but do not remove interface dependencies.

## 6. Milestones and completion gates

### W1: Format and integrated browser round trip

Implement the codec, minimal session/editor boundary, and New → edit → Download → Open, including title/view preservation, safe invalid-file handling, and fresh history.

**Done when:** a production browser test reopens actual downloaded bytes and verifies title/content/view, codec invalid cases are covered, editor regressions pass, and schema/docs match emitted bytes.

### W2: Complete web workflow

Implement Home/header/File menu, recovery, modified state, replacement protection, and keyboard handling. UI and lifecycle work may run independently once contracts and Editor ownership are fixed.

**Done when:** all applicable UX section 17.9 cases have automated rule/state, browser, production, and visual/motion coverage; browser limitations follow resolved UX policy; acceptance documentation points to actual tests. W1 and W2 together form the first new milestone.

### D1: Desktop shell and native file lifecycle

Add `apps/desktop`, reuse editor/codec/session, and implement Open/Save/Save As, dirty guarding, app-data recovery, full recents, missing-file actions, and external revision checks.

**Done when:** native file/lifecycle behavior is automated, web/desktop files round-trip both ways, cancellation/failure and concurrent edits preserve the correct state, and web/editor regressions stay green. Resolve Windows/WebView2 targets before release claims.

### D2: Direct EXE and integrated acceptance

Build an unbundled Windows executable with embedded frontend and per-user app data. Document runtime prerequisites and reproducible build/run/test commands. A setup EXE alone is insufficient; direct execution still depends on WebView2 and does not imply a self-contained runtime or USB-style storage.

**Done when:** the produced EXE has automated launch/integration coverage on the declared target, desktop acceptance is complete, and reproducible commands and limitations are documented. D1/D2 form the second new milestone. Installer distribution, file associations, signing, and auto-updates are not implicit additions.

## 7. Validation and reporting

Run from the root: `npm run format:check`, `npm run check`, `npm run build`, then `npm test`. Build before production tests. Follow README's Windows permissions, server-port, and screenshot-baseline guidance. Add documented desktop checks when implemented; the web suite cannot certify native packaging.

Acceptance is automated, including required visual/motion checks. Initial visual baselines require deliberate design judgment; routine manual/LLM browser testing is not the acceptance mechanism. Do not regenerate snapshots merely to silence failures.

Update UX for resolved product decisions, implementation decisions for architecture, format/schema for encoding, README for executable commands, and acceptance coverage for implemented tests. Keep milestone status honest: specifications are not delivered functionality.

Report the completed milestone, changed behavior, passing commands, actual artifact location, and unresolved/unverified behavior. Individual worker completion does not establish integrated acceptance.

## 8. Delivery record

The user authorized execution, Sol 6.1 implementers, separate Luna reviews, and best judgment for unspecified decisions. UX section 17.10 now records those choices rather than leaving them as open questions.

- **W1/W2:** portable v1 codec/schema/fixtures; actual browser Download/Open round trips; Home, title, File menu, content-only modification baseline, guarded replacement, draft recovery, and live/abandoned tab ownership. Cancelled guarded downloads remain modified until explicit retention acknowledgement. Existing editor interactions and screenshot baselines remain intact.
- **D1/D2:** shared Tauri application, native Open/Save/Save As and close guarding, safely replaced files with content-hash conflicts, complete recents, missing-file repair, and per-user recovery with process-held ownership. Recovery claims read the latest stored content and file identity; cancelled claims release ownership without deleting the source.
- **Artifact:** `apps/desktop/src-tauri/target/release/takt.exe`, with embedded frontend, targeting Windows 11 x64 and installed Evergreen WebView2. No Takt installation is required. Other Windows versions/architectures, signing, associations, installers, and updates remain outside this target.
- **Acceptance:** root formatting/type/build and all four browser test layers passed: 184 rules, 573 component checks, 11 production checks, and 31 visual checks. `desktop:test` passed eight native tests and six adapter tests. The EXE launch check exchanges actual browser-exported bytes through native Save and browser Open, exercises real IPC/file/recovery/recent operations and native close cancellation, and runs a copied EXE from an isolated directory to verify its embedded frontend. [Acceptance coverage](acceptance-coverage.md#project-files-recovery-and-desktop-acceptance) supplies the actual test references; [README](../README.md#project-files-and-windows-desktop) supplies reproducible build and launch commands.
- **Review and limits:** separate Luna Standards and Spec reviews finished with no unresolved findings. Native picker cancellation/failure is exercised through deterministic adapter and shared-UI tests; the OS picker widgets themselves are not automated. Shared-file revision checking has a documented compare/replace race and does not provide exclusive project-file ownership. Browser recovery needs available storage and secure-context Web Locks; failures warn and preserve explicit file operations.

Pre-existing documentation changes and unrelated research were preserved. The feature and both lockfiles are recorded in a local feature commit; unrelated research is excluded. No push, installer, or publication is included in this delivery.
