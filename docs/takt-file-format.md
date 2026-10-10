# Takt file format

**Status:** v1 codec and wire contract implemented, October 10, 2026. Browser/desktop integration acceptance is tracked separately.

**Authority:** [UX section 17](ux-specification.md#17-project-files-home-and-desktop) defines what survives saving and reopening. [Implementation decisions section 17](implementation-decisions.md#17-project-files-and-desktop-implementation) defines the codec/session/platform boundaries.

## 1. Agreed direction

- One human-readable, versioned JSON `.takt` file per chart, used identically by browser and desktop.
- Preserve title, semantic chart data, and saved viewing state without depending on a calendar anchor.
- Preserve IDs and explicit color overrides rather than saving only rendered geometry or effective colors.
- Keep filesystem locations, recents, recovery metadata, selection, transient UI, and undo history outside the portable file.
- No required import/export support for other project formats. The [format research](research/project-files-and-desktop.md) explains the fit assessment.

## 2. v1 envelope

Use UTF-8 JSON with a recognizable format identifier and an integer schema version independent of the application version. This complete example uses the current model's zero-based time coordinates:

```json
{
  "format": "takt",
  "version": 1,
  "title": "Autumn launch",
  "document": {
    "display": "weeks",
    "sections": [{ "id": "section-1", "name": "Launch", "color": 40 }],
    "rows": [{ "id": "row-1", "sectionId": "section-1", "name": "Design" }],
    "bars": [
      {
        "id": "bar-1",
        "rowId": "row-1",
        "start": 0,
        "end": 3,
        "name": "Prepare"
      }
    ],
    "milestones": [
      { "id": "milestone-1", "rowId": "row-1", "boundary": 3, "name": "Ready" }
    ]
  },
  "view": {
    "zoom": 1,
    "firstWeek": -2,
    "scrollTop": 0,
    "collapsedSectionIds": []
  }
}
```

The `document` shape follows [the existing model](../apps/web/src/model/document.ts); the file codec is a deliberate boundary, not an unrestricted dump of application state. The [JSON Schema](schemas/takt-v1.schema.json) and [mixed valid fixture](../apps/web/src/project/fixtures/mixed.takt) describe this contract; an [invalid overlap fixture](../apps/web/src/project/fixtures/invalid-overlap.takt) exercises semantic rejection. Cross-record invariants require semantic validation beyond JSON Schema.

## 3. Field semantics

| Field                      | Wire meaning                                                                                                                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `format`                   | Literal `"takt"`; the extension alone is not proof of a valid document.                                                                                                                            |
| `version`                  | Positive integer wire-schema version; v1 writes `1`.                                                                                                                                               |
| `title`                    | Stored project title, separate from filesystem filename. Titles are trimmed; an empty title becomes `Untitled`.                                                                                    |
| `document.sections`        | Ordered section records with unique string IDs, names, and optional hue overrides.                                                                                                                 |
| `document.rows`            | Ordered row records with IDs, owning `sectionId`, and names. Per-section row order follows this array.                                                                                             |
| `document.bars`            | Records with ID, owning `rowId`, `start`, exclusive `end`, name, and optional color.                                                                                                               |
| `document.milestones`      | Records with ID, owning `rowId`, week-ending `boundary`, name, and optional color.                                                                                                                 |
| `document.calendar`        | Optional `{ "week": integer, "date": "YYYY-MM-DD" }`; assigns that date to the start of the zero-based week.                                                                                       |
| `document.display`         | `"weeks"` or `"dates"`; Dates requires a calendar reference. Write an explicit value in v1.                                                                                                        |
| `view.zoom`                | Multiplier, currently 0.125–2 inclusive; `1` means 100%.                                                                                                                                           |
| `view.firstWeek`           | Effective timeline coordinate at the visible timeline's left edge, potentially fractional. Normalize native horizontal scrolling into this value; do not separately save competing scroll offsets. |
| `view.scrollTop`           | Proposed nonnegative vertical CSS-pixel offset, clamped to the restored chart's available extent. A semantic row anchor is a possible technical refinement before v1 is frozen.                    |
| `view.collapsedSectionIds` | IDs of collapsed sections. Save settled user view state, excluding temporary drag-hover expansion.                                                                                                 |

The envelope requires `document` and `view`, every semantic collection, each record ID/name, ownership/timing fields, and every view field. Only calendar, display, and color overrides are optional. Omitted display becomes `weeks`; null is not omission. Unknown properties at every level are accepted and stripped. IDs must contain a non-whitespace character, retain their original spelling, and are treated as opaque strings (including `__proto__` and `constructor`). Duplicate collapsed IDs and references to nonexistent sections are rejected. No artificial string or collection-count limits are imposed. New projects use one unnamed section/row and view `{zoom: 1, firstWeek: -2, scrollTop: 0, collapsedSectionIds: []}`.

### Time and color invariants

- Internal/wire coordinate `0` is the beginning of visible Week 1. Negative coordinates are valid. Do not apply a second one-based conversion during loading.
- A bar `[0, 3)` occupies visible Weeks 1, 2, and 3. A bar starting at `3` is adjacent, without overlap.
- Milestone `boundary: 3` marks the end of visible Week 3. With a calendar reference, its date is the last day before the boundary, not the next week's starting date.
- Calendar `{ "week": 0, "date": "2026-10-05" }` maps the start of visible Week 1 to October 5, 2026. Use date-only arithmetic consistent with the existing calendar module.
- Committed item timing uses integer week boundaries; fractional numbers belong only to view state. All semantic week coordinates and calendar.week are safe integers within [-1,000,000, +1,000,000]. View firstWeek uses the same bounds but allows fractions. This conservative range protects derived calendar arithmetic and timeline rendering from overflow.
- IDs are globally unique across sections, rows, bars, and milestones; all ownership references resolve.
- Bars have positive duration and cannot overlap within one row; adjacent bars are valid. Milestones may coincide with bars, but duplicate milestone boundaries in the same row are invalid.
- Empty sections and even zero sections are valid existing chart states, distinct from the one-section/one-row defaults of a new document.
- Current colors are finite numeric hues in `[0, 360)`, with fixed appearance parameters owned by the palette module. Missing item color means inheritance; missing section color means the existing default. Keep those omissions rather than resolving inheritance into overrides.

## 4. Codec and evolution requirements

Implement pure encoding and decoding independently of browser/Tauri file APIs. Validate external JSON as unknown input, including nested value types and cross-record invariants, before constructing trusted document objects. Loading must not mutate the active document on failure.

Evolution policy: reject unsupported future versions with an actionable explanation rather than silently dropping fields; add explicit, tested migrations when a later version is introduced. Invalid inputs throw explanatory `Error` objects with an `Invalid .takt file` prefix; parse errors identify JSON and field validation identifies the affected path where available. Version 1 is the first delivered `.takt` format; there is no earlier public format to migrate.

The pure API lives in `apps/web/src/project/format.ts`: `decodeProject(unknown)`, `parseProject(string)`, `encodeProject(ProjectSnapshot)`, `contentKey(ProjectSnapshot)`, `newProject()`, `defaultProjectView()`, and `suggestedFilename(title)`. Encoding validates and strips snapshots, writes two-space indented JSON with a final newline, and preserves collection order. `contentKey` canonicalizes title and document property order, including explicit default Weeks display, and excludes view. Filename suggestions preserve Unicode, replace Windows/path-forbidden characters with underscores, strip trailing periods/spaces, prefix reserved Windows device names, and append `.takt`.

Use deterministic serialization so ordinary save/reopen cycles do not reorder semantic collections or cause avoidable diffs. Round-trip tests should compare semantic data and view, not require preservation of arbitrary input whitespace. Do not introduce timestamps, machine paths, an application-managed project identity, or generic extension fields without a demonstrated need.

## 5. Recovery is a separate local format

Recovery records may embed a portable snapshot but need their own version and lifecycle metadata. A desktop record may additionally carry the original path and file revision; browser records may carry session/tab ownership and the last export baseline. None of these belong in an exported `.takt` file.

The saved-content baseline excludes `view`; therefore navigation-only changes do not make a document dirty even though the next explicit save includes them. A later save cannot acknowledge edits made after its captured snapshot. Resolve the browser completion and multi-instance questions in UX section 17.10 before implementing recovery cleanup.

## 6. Required verification

Prove lossless semantic round trips for Unicode names/titles, unnamed items, negative weeks, adjacent bars, milestones, arbitrary row/section ordering, empty structure, inherited/custom hues, calendar mode, and saved view state. Cover invalid JSON/types, duplicate IDs, missing owners, overlapping bars, duplicate milestones, bad dates/colors, invalid view numbers, and unsupported versions according to the frozen contract.

Exercise real downloaded file bytes in browser integration, cross-platform web-to-desktop and desktop-to-web reopening in the desktop milestone, and ID generation after opening a file whose IDs resemble locally generated ones. Do not count a schema example or a successful internal-object cast as an import test.
