# Takt agent guide

Takt is a desktop-browser Gantt editor. The shared Svelte 5, Vite, and TypeScript app lives in `apps/web`; Windows Tauri packaging lives in `apps/desktop`.

- Before changing product behavior, read `docs/ux-specification.md`. For architecture, interaction-engine, component, or test-coverage decisions, also read `docs/implementation-decisions.md`. Product behavior belongs in the UX specification.
- For project files, Home, recovery, recent files, or desktop packaging, start with `docs/project-files-orchestrator-handoff.md`; it links the agreed behavior, proposed format, unresolved questions, and agent ownership plan.
- Use `ui-prototype/` as the Apricot visual reference. It is static prototype code, not production code to port wholesale.
- Use npm from the repository root and commit the root `package-lock.json`. See `README.md` for setup, individual commands, fixtures, and browser-test caveats.
- While iterating, run only the tests for the change: one Playwright test by `-g` in one browser, plus the fast rule tests. The full component suite takes about ten minutes; run the complete sequence once, at the end.
- Complete changes with `npm run format:check`, `npm run check`, `npm run build`, then `npm test`. Build before integrated production tests. For desktop changes, also run the native and direct-EXE checks documented in `README.md`.
- An interaction is complete only when its agreed behavior has automated coverage, including visual and motion checks where required by the implementation decisions. Routine manual or LLM-driven browser testing is not the acceptance mechanism.
- If product behavior is unresolved in the specifications and code, ask the user before choosing it.
- Keep this guide concise and current. Put development instructions in `README.md`, architecture and testing conventions in implementation decisions, and local contracts near their code.
