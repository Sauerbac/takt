# Project files and desktop packaging

Research date: October 10, 2026. Status: research background. The resulting product decisions are now recorded in [UX section 17](../ux-specification.md#17-project-files-home-and-desktop); start implementation from the [orchestrator handoff](../project-files-orchestrator-handoff.md).

## Existing formats

| Candidate                     | Verified capabilities                                                                                                                                                                                                                                                                                                                            | Fit assessment for Takt                                                                                                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Microsoft Project XML / MSPDI | Published XML schema with tasks, calendars, resources and assignments; task data includes dates, duration, milestones and hierarchy. [Project schema](https://learn.microsoft.com/en-us/office-project/xml-data-interchange/project-element), [task schema](https://learn.microsoft.com/en-us/office-project/xml-data-interchange/task-element). | Useful interoperability target when a specific workflow requires it. Takt's undated relative weeks, independent named lanes and multiple periods per lane require mapping choices. Not a natural lossless native representation. |
| GanttProject `.gan`           | Native text/XML, confirmed by its maintainer. The application supports task hierarchy, dependencies, milestones and resources. [Maintainer guidance](https://help.ganttproject.biz/t/clear-completion-percentage-for-all-tasks/1764), [official repository](https://github.com/bardsoftware/ganttproject).                                       | Another application format rather than a neutral Takt document model. Investigate a converter only if GanttProject interoperability is requested.                                                                                |
| Mermaid Gantt                 | Text syntax with sections, tasks, dates/durations and milestones. Compact mode can put multiple tasks in one row. [Official syntax](https://mermaid.js.org/syntax/gantt.html).                                                                                                                                                                   | Potential documentation export. Compact packing does not itself establish Takt's stable, named lane identities, independent milestone placement and inherited hue semantics. Treat round-trip fidelity as unproven.              |

Assessment: the investigated formats do not provide an obvious lossless replacement for Takt's model. This is not a claim that no other suitable format exists. Prefer a native versioned JSON document, provisionally `.takt`, and add targeted interchange only when a destination is known.

The current [document model](../../apps/web/src/model/document.ts) already represents ordered sections and rows, bars with exclusive end boundaries, milestones at boundaries, optional calendar anchoring, display mode and hue overrides. Its coordinates are zero-based; the visible week numbers add one. A file contract must specify that relationship explicitly. Preserve structure and semantic colors instead of exporting only painted rectangles.

Proposed format boundary: a recognizable format identifier and integer schema version around document content, with stable IDs and explicit coordinate semantics. Decode untrusted input, validate shape and model invariants, then replace the active document only after success. Existing `assertDocument` is an internal invariant check, not a complete unknown-JSON decoder. Keep file paths, recent-document entries, undo history and active gestures outside the portable document. Whether zoom/collapse/view state travels with a file is a product decision.

## Browser files and recent documents

- Native-style browser open/save handles exist, but `showOpenFilePicker` is not supported by all widely used browsers and requires a secure context. A cross-browser product needs a file-input/download fallback or an explicit browser support policy. [MDN API documentation](https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker).
- Supporting browsers can serialize file handles into IndexedDB and use them for recent-file reopening. Permissions may need to be requested again; a remembered handle does not guarantee continued access. [Chrome implementation guidance](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access).
- Browser-managed documents and drafts can persist in IndexedDB. Storage is scoped to the origin and is best-effort by default; persistence requests protect against automatic eviction when granted, but users can still clear site data. A browser library is therefore distinct from files the user has saved in a normal folder. [Storage lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

Recommendation: decide ownership before naming the buttons. With a file-owned model, Open and Save refer to user files, and recovery drafts are separate. With an app-owned library, edits persist into the library and export creates a portable copy. Both can offer recents, but a recent browser draft and a recent filesystem document promise different things. “Upload” is misleading if the file stays entirely on the device; prefer Open or Import according to whether it establishes the working document or copies one into a library.

## Tauri and Windows

Tauri v2 explicitly supports Vite's development server and built `dist` directory. The existing Svelte/Vite frontend can be shared rather than rewritten. [Vite integration](https://v2.tauri.app/start/frontend/vite/).

Official plugins provide native open/save dialogs and filesystem reading/writing. Saving the document bytes remains a separate operation from choosing a destination. [Dialog plugin](https://v2.tauri.app/plugin/dialog/), [filesystem plugin](https://v2.tauri.app/plugin/file-system/).

Windows distribution supports an NSIS `-setup.exe` installer and WiX `.msi`. These are installation packages; a no-install portable executable is a separate distribution requirement. Tauri uses WebView2 on Windows. The default installer can obtain the runtime when missing, and offline bundling options exist. A portable download must also account for the runtime and any bundled resources; “one EXE” alone is not proof of installation-free operation on every PC. [Windows packaging and runtime options](https://v2.tauri.app/distribute/windows-installer/).

Tauri also supports building without bundling an installer using `build --no-bundle`. The official Tauri action distinguishes an unbundled Windows EXE from an installer EXE, while cautioning that this is not a fully supported portable mode. Local frontend assets can be embedded in the application binary. A direct EXE can use the installed WebView2 runtime and keep settings in per-user app data; direct execution does not require USB-style portable storage. [Build/bundle separation](https://v2.tauri.app/distribute/), [unbundled executable upload](https://github.com/tauri-apps/tauri-action#inputs), [frontend embedding](https://v2.tauri.app/reference/config/#frontenddist).

Recommendation: share the editor, file codec and document lifecycle, with browser and Tauri storage adapters. Keep desktop integration at that boundary. Do not add cloud or general project-management entities merely to make the file sound extensible.

## Original research questions

These questions guided the design discussion. The agreed answers and remaining edge cases now live in UX section 17; this historical list is not a request to reopen settled decisions.

1. Does “all sorts of projects” mean generic timeline diagrams, or future tasks/resources/dependencies and scheduling?
2. Is any existing application a required import/export partner now?
3. Are user files authoritative, or does Takt own an automatically saved project library?
4. Is Tauri part of this milestone, and does EXE mean installer or portable application?
5. After those foundations: name/title, dirty state, recovery, close/switch behavior, missing recent files, duplicate copies, externally changed files, view-state persistence and newer-format rejection.
