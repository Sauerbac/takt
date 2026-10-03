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

This is a visual prototype. Chart behavior, persistence, and export remain outside the prototype work.
