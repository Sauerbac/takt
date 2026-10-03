# Takt agent guide

Takt is a desktop-browser Gantt editor built around direct manipulation. Before changing product behavior, read `docs/ux-specification.md`. Before making architectural, interaction-engine, component, or test-coverage decisions, also read `docs/implementation-decisions.md`. Use `ui-prototype/` only as the visual reference; it is static prototype code, not production code to port wholesale.

## Current technical direction

- Build the browser application with Svelte 5, Vite, and TypeScript under `apps/web`.
- Keep the repository ready for a future sibling desktop application, while introducing no Tauri-specific implementation until that work begins.
- Keep chart rules, gesture transactions, and undo/redo behavior independent from Svelte rendering so they can be tested deterministically.
- Build the chart specifically for Takt. Use custom Takt components and styling; unstyled primitives are acceptable for standard controls such as menus and dialogs.
- Treat smooth, reversible drag previews as product behavior. The dragged object follows the pointer immediately while surrounding content animates toward the current proposed result.

## Completion and testing

An interaction is complete only when its agreed behavior has automated coverage. Prefer fast TypeScript rule and state-transition tests, real-browser component tests for pointer/focus/DOM behavior, and a small integrated Playwright suite. Add visual comparisons and focused animation checks where appearance or motion is part of the requirement. Routine manual or LLM-driven browser regression testing is not the acceptance mechanism.

Implement vertical slices. Establish the minimum shared UI foundation, then complete and test a difficult interaction through rendering, rules, cancellation, commit, undo, and redo before expanding the component catalogue.

## Keep this file current

Extend this file as soon as the project gains concrete setup, build, development, formatting, type-checking, and test commands. Record the commands agents should run and the completion checks for changes. Also add any non-obvious repository conventions or recurring implementation traps. Keep detailed product behavior in the specifications instead of duplicating it here.

If any question arises during implementation and the answer is not explicit in the specifications or code, ask the user before choosing a behavior.
