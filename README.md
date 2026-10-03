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

The first vertical slice lives in `apps/web`, built with Svelte 5, Vite, and TypeScript. It supports drawing, inline naming, moving and resizing bars in one row, reversible collision previews, cancellation, and atomic undo/redo. Contents reset on refresh.

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

Component fixtures are available through the development server at `/tests/fixtures/index.html?state=Empty`, `?state=Chain`, and `?state=Narrow`. They expose the same production components with deterministic initial data, and are excluded from the static production entry.

The implementation follows the staged sequence in the implementation decisions. Additional rows and sections, milestones, timeline navigation, calendar mode, context menus, persistence, export, and desktop packaging remain future work.
