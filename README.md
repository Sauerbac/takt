# Takt

Takt is a desktop web app for creating Gantt charts through direct manipulation: drag to draw and adjust bars, place milestones, organize rows into sections, and edit labels inline.

The name is German; the interface is English. Takt creates charts without sign-in and keeps them on your machine. It is a chart editor, not a project-management system.

It ships in two forms that share one editor:

- **Browser app** (`apps/web`): static files, served from any HTTPS host. It opens local `.takt` files and downloads edited copies.
- **Windows desktop app** (`apps/desktop`): a single Tauri executable with native Open, Save, recent files, and recovery.

## Download

The Windows executable is attached to each [GitHub release](../../releases/latest) as `Takt-<version>-windows-x64.exe`, with a SHA-256 checksum beside it. It runs directly on **Windows 11 x64 with the Microsoft Edge WebView2 Evergreen Runtime**; there is nothing to install. It is not code-signed, so Windows SmartScreen asks for confirmation on first launch.

## Documentation

| Document                                                                | Contents                                                                |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [UX specification](docs/ux-specification.md)                            | Agreed behavior, examples, and acceptance criteria. Authoritative.      |
| [Implementation decisions](docs/implementation-decisions.md)            | Architecture, interaction engine, components, and the testing contract. |
| [`.takt` file format](docs/takt-file-format.md)                         | The portable project file and its schema.                               |
| [Acceptance reconciliation](docs/acceptance-coverage.md)                | Which automated test covers which agreed behavior.                      |
| [Implementation history](docs/implementation-history.md)                | What each implementation slice added, in order.                         |
| [Project-files handoff](docs/project-files-orchestrator-handoff.md)     | Delivery plan for project files, Home, recovery, and desktop packaging. |
| [Takt design system](https://claude.ai/artifact/K1y9MSi2FfLWuh9ihQPUHh) | Tokens and components: Geist, neutral zinc greys, apricot `#b35d35`.    |

The earlier design exploration and the superseded Apricot prototype are preserved under the tag `archive/design-exploration`; the compact-bar interaction prototypes are under `archive/compact-bars-prototypes`.

## Development

Use Node.js 22.12+ and npm, from the repository root. `apps/web` is the `@takt/web` workspace and `apps/desktop` is `@takt/desktop`. Commit the root `package-lock.json`.

```sh
npm ci
npx playwright install chromium firefox webkit
npm run dev
```

Validate a change with `npm run format:check`, `npm run check`, `npm run build`, then `npm test`.

| Command                   | Purpose                                                                         |
| ------------------------- | ------------------------------------------------------------------------------- |
| `npm ci`                  | Install the locked dependencies.                                                |
| `npm run dev`             | Start the browser app at Vite's printed local URL.                              |
| `npm run build`           | Build both frontends; the static browser app lands in `apps/web/dist`.          |
| `npm run preview`         | Serve the production build locally.                                             |
| `npm run format`          | Format source and documentation with Prettier.                                  |
| `npm run format:check`    | Check formatting.                                                               |
| `npm run check`           | Check that all manifests share one version, then Svelte and strict TypeScript.  |
| `npm run test:rules`      | Run deterministic document, gesture, and history tests in Vitest.               |
| `npm run test:components` | Run component interaction and motion tests in Chromium, Firefox, and WebKit.    |
| `npm run test:e2e`        | Run the integrated pointer scenarios against the production build.              |
| `npm run test:visual`     | Compare component screenshots in the Playwright Linux container (needs Docker). |
| `npm test`                | Run all four test layers; build first.                                          |

Build before running browser tests: Playwright starts the development server on port 5173 and the production preview on port 4173. Both ports must be available, or already serve this checkout. On Windows, browser installation and test execution may need sandbox escalation; Vite's config loader reads ancestor directories outside the checkout.

### Visual tests

Screenshot baselines are rendered by Chromium in the official Playwright Linux image, the same image CI runs in, so a developer machine and CI compare identical pixels. `npm run test:visual` therefore needs a running Docker engine. It copies the checkout into the container, installs and builds there, runs the `visual` project, and copies snapshots and failure output back. The image tag follows the `@playwright/test` version in `package-lock.json`; after upgrading Playwright, update the tag in `.github/workflows/ci.yml` and regenerate the baselines.

After a reviewed appearance change, regenerate baselines deliberately:

```sh
npm run test:visual -- --update-snapshots
```

Other Playwright arguments pass through the same way, for example `-- -g "Home"`. Baseline updates require design review; screenshot assertions are the recurring acceptance mechanism.

### Component fixtures

Component fixtures render the production components with deterministic initial data. They are served by the development server at `/tests/fixtures/index.html?state=<name>` and are excluded from the production build.

| State                                  | Exposes                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------- |
| `Empty`, `TallEmpty`                   | The empty editor and the hint following the first visible empty row.      |
| `Chain`, `Narrow`                      | Cascading pushes in one row.                                              |
| `Separated`, `EdgeContact`             | Separated collision destinations and sustained contact while scrolling.   |
| `CrossRows`, `RowEntry`, `BetweenBars` | Cross-row cascades, approach direction on row entry, two-sided insertion. |
| `Tall`                                 | Vertical edge scrolling and milestone conflicts.                          |
| `Sections`, `TallSections`             | Structural flow, empty sections, confirmations, and scrolling.            |
| `CalendarColors`                       | Dates, reference weeks, inherited and overridden colors.                  |
| `ShortBars`                            | One-week bars, separated and adjacent, plus mixed durations.              |

`/tests/fixtures/desktop.html` renders the shared shell against a deterministic desktop adapter.

### Icons

The logo is the **Deep inks** mark: three offset Gantt bars in apricot, violet, and teal. `apps/web/src/assets/takt-mark.svg` is the header mark and `takt-icon.svg` adds a pale apricot tile for icons. After editing `takt-icon.svg`, run `npm run generate:icons` to regenerate `apps/web/public/favicon.ico`, `apps/web/public/app-icon.png`, and `apps/desktop/src-tauri/icons/icon.ico` with the installed Playwright Chromium.

## Desktop app

Desktop shares the application, editor, codec, and session with the browser, and adds native Open/Save/Save As at ordinary user-selected paths, SHA-256 external-change checks, safe file replacement, recent files, and per-user recovery. [UX section 17](docs/ux-specification.md#17-project-files-home-and-desktop) defines the behavior. Other Windows versions and architectures, signing, installers, file associations, and updates are outside the current target.

Build prerequisites: Node.js 22.12+, npm, Rust with the MSVC x64 toolchain, Visual Studio C++ build tools and Windows SDK, and WebView2. The root lockfile and `apps/desktop/src-tauri/Cargo.lock` pin dependencies.

| Command                       | Purpose                                                                     |
| ----------------------------- | --------------------------------------------------------------------------- |
| `npm run desktop:dev`         | Open the native development window.                                         |
| `npm run desktop:test`        | Run the native filesystem tests and the adapter tests.                      |
| `npm run desktop:build`       | Produce the unbundled release executable.                                   |
| `npm run desktop:test:launch` | Start that executable against isolated data and check real file operations. |

For a desktop change, run the usual sequence, then `npm run desktop:test`, `npm run desktop:build`, and `npm run desktop:test:launch`. The launch check needs an interactive Windows session with WebView2 and Playwright's Chromium. Native builds may need sandbox escalation for Cargo caches, compiler processes, and dependency downloads.

The executable is `apps/desktop/src-tauri/target/release/takt.exe`. It embeds the frontend, so rebuild it after shared UI changes, and close a window launched from it first; Windows will not replace an executable in use. Project data stays at the chosen paths; application data lives in `%APPDATA%/de.takt.editor`.

## Hosting the browser app

`apps/web/dist` is a self-contained static site with no backend, environment variables, or network requests. Serve it at the root of a host over HTTPS; draft recovery relies on Web Locks, which browsers offer only in secure contexts.

The repository's `Dockerfile` builds the app and serves it with nginx on port 80:

```sh
docker build -t takt .
docker run --rm -p 8080:80 takt
```

**Coolify:** add a resource from this repository through Coolify's GitHub App, choose the **Dockerfile** build pack, and set the exposed port to `80`. Coolify provides the domain and HTTPS, uses the image's health check, and redeploys on each push to `main` when automatic deployment is on. Alternatively, deploy the released image `ghcr.io/sauerbac/takt:<version>` (or `:latest`) as a Docker image resource; while the package is private, Coolify needs registry credentials for it.

## Continuous integration and releases

Changes reach `main` through pull requests. `.github/workflows/ci.yml` runs on every pull request and on `main`:

- **Web checks and browser tests** runs the full validation sequence inside the Playwright Linux image.
- **Container image** builds the `Dockerfile` and fetches the served page.
- **Windows executable** runs the native tests, builds the EXE, and runs the launch check. Pull requests that touch nothing under `apps/`, `scripts/`, the workflows, or the root manifests skip it.
- **CI passed** summarizes the others and is the one required check.

To release, set the same version in `package.json`, both workspace `package.json` files, `tauri.conf.json`, and `Cargo.toml` (`npm run check` verifies they agree), merge, then tag that commit:

```sh
git tag v0.1.0
git push origin v0.1.0
```

`.github/workflows/release.yml` checks the tag against the version, runs the complete CI, pushes the web image to `ghcr.io`, and creates the GitHub release with the executable, its checksum, and generated notes. A tag with a suffix such as `v0.2.0-rc.1` becomes a prerelease and does not move `latest`.

## License

[MIT](LICENSE)
