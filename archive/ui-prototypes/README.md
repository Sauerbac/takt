> Archived October 3, 2026. Apricot was selected; further refinement takes place in [the single active UI prototype](../../ui-prototype/index.html). The content below records the earlier exploration. Historical generator commands and preview URLs refer to its original location.
# Takt UI prototypes

Twelve throwaway visual directions answering: **What should the Takt editor look like?** The original six are preserved. Round two adds four less corporate directions, version 11 explores the Swiss Precision reference, and version 12 refines the original Swiss Grid based on your feedback.

Open `index.html` directly in a browser. Everything works from disk: no dependencies, build, account, remote fonts, or JavaScript. `compare.html` lets you select two directions side by side. The currently running local preview is at <http://127.0.0.1:4173/ui-prototypes/>.

## Version 12: twenty-four accent palettes

Open [the color gallery](colors.html) or [compare two color themes](compare-colors.html). This round answers: **Which accent palette should the app use?** Every preview uses the exact version 12 editor markup, geometry, typography, 44 px rows, neutral light page background and white canvas. Only the brand/focus accent and section/bar colors change. Earlier designs, including the original version 12, stay available.

| Theme | Accents | Character |
| --- | --- | --- |
| [12A Navy](12a-navy.html) | Navy, sage, muted ochre | Original reference |
| [12B Graphite](12b-graphite.html) | Graphite, petrol teal, amber | Restrained with warmth |
| [12C Forest](12c-forest.html) | Pine, dusty blue, bronze | Calm and natural |
| [12D Sandstone](12d-sandstone.html) | Umber, olive, muted plum | Warm and considered |
| [12E Lagoon](12e-lagoon.html) | Ocean teal, cornflower, golden sand | Fresh and colorful |
| [12F Iris](12f-iris.html) | Purple, soft teal, honey | Gently expressive |
| [12G Coral](12g-coral.html) | Coral, lavender, sea green | Warm and playful |
| [12H Citrus](12h-citrus.html) | Chartreuse, vivid blue, raspberry | Bright and playful |
| [12I Electric Blue](12i-electric-blue.html) | Cobalt, teal, tangerine | Strong and crisp |
| [12J Vermilion](12j-vermilion.html) | Vermilion, charcoal, yellow | Strong and graphic |
| [12K Indigo](12k-indigo.html) | Indigo, lime, poppy | Strong and unexpected |
| [12L Orchid](12l-orchid.html) | Orchid, turquoise, mango | Strong and creative |
| [12M Fuchsia](12m-fuchsia.html) | Fuchsia, aubergine, blue | Strong and expressive |
| [12N Emerald](12n-emerald.html) | Emerald, mandarin, royal blue | Strong and fresh |
| [12O Tangerine](12o-tangerine.html) | Tangerine, violet, turquoise | Strong and sunny |
| [12P Ocean Pop](12p-ocean-pop.html) | Azure, cyan, lime | Strong and clear |
| [12Q Acid Lime](12q-acid-lime.html) | Lime, plum, orange | Strong and daring |
| [12R Primary](12r-primary.html) | Blue, cherry red, yellow | Strong and playful |
| [12S Cornflower](12s-cornflower.html) | Cornflower, teal, apricot | Medium and clear |
| [12T Apricot](12t-apricot.html) | Apricot, lavender, sea blue | Medium and warm |
| [12U Periwinkle](12u-periwinkle.html) | Periwinkle, jade, honey | Medium and creative |
| [12V Jade](12v-jade.html) | Jade, denim, terracotta | Medium and natural |
| [12W Rose](12w-rose.html) | Rose, iris, marigold | Medium and playful |
| [12X Pistachio](12x-pistachio.html) | Pistachio, cornflower, coral | Medium and lively |

The latest S–X palettes sit between the two earlier rounds, using medium-strength colored fills and dark labels. I–R use saturated, solid-color bar fills, with white or dark labels. A–H preserve the earlier pastel treatments. All twenty-four keep the original neutral light backgrounds and white chart canvas. The gallery leads with the six balanced palettes; the comparison initially shows Cornflower against Apricot. Expand “Compare with earlier palettes” on either side to access A–R.

Use the floating switcher to cycle within a color round in a full-size preview, or choose any theme independently on each side of the comparison. Empty / Example and Weeks / Dates retain their native HTML/CSS behavior. Scroll to inspect contextual palettes, inline editing and other component states. The color review controls are separate from the app toolbar. Tell us the preferred letter or name; no theme has been selected for implementation yet.

`color_themes.py` generates this round from version 12. `color-themes.css` contains accent tokens and color-only rules for saturated bars and their labels; `color-gallery.css`, `color-comparison.css` and `color-review-controls.css` style review controls. Running `python ui-prototypes/build.py` regenerates all twelve designs and then all twenty-four accent palettes. Running `python ui-prototypes/color_themes.py` regenerates just the color round.

If you prefer a local server, run this from the repository root:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Then open <http://127.0.0.1:4173/ui-prototypes/>. A local server is optional; double-clicking `index.html` is sufficient.

## The design systems

| Direction | Composition | Visual vocabulary |
| --- | --- | --- |
| [01 Swiss Grid](01-swiss-grid.html) | Full-width grid; brand header and toolbar row | Navy, orderly spacing, crisp borders, small rectangular bars |
| [02 Quiet Ledger](02-quiet-ledger.html) | Inset editorial sheet; serif masthead | Warm white paper, botanical tones, serif/sans typography, fine rules |
| [03 Signal](03-signal.html) | Narrow identity rail; compact workspace header | Cobalt accents, technical density, section edge markers, framed canvas |
| [04 Clay Studio](04-clay-studio.html) | Open canvas; toolbar dock below | Terracotta, warm whites, rounded periods, softer geometry |
| [05 Monograph](05-monograph.html) | Sparse drafting sheet; compact command strip | Graphite, monospaced time labels, square edges, restrained color |
| [06 Soft Geometry](06-soft-geometry.html) | Detached top control strip; elevated chart | Violet, muted complementary accents, rounded geometry, gentle borders |
| [07 Grid Club](07-grid-club.html) | Swiss-inspired compact masthead and precise chart | Oversized ink wordmark, chartreuse, coral, square periods; independent studio energy |
| [08 Signal House](08-signal-house.html) | Signal-inspired rail containing the complete small toolset | Bright cobalt, apricot, pill-shaped week labels, personal rhythm |
| [09 Daybreak](09-daybreak.html) | Clay-inspired open canvas and rounded command capsule | Peach, lilac, sea blue, a warm serif heading, asymmetric rounded periods |
| [10 Fieldwork](10-fieldwork.html) | Swiss clarity with Clay warmth in a notebook frame | Olive ink, dotted rules, paper-edge perforations, tactile bars |
| [11 Swiss Precision](11-swiss-precision.html) | White panel with a compact header and rounded grid | Strong Arial type, vermilion selection, numbered sections, charcoal and teal |
| [12 Swiss Grid / Refined](12-swiss-grid-refined.html) | Original Swiss Grid with tighter spacing | 14 px row names, 13 px bar labels, 44 px rows, even week backgrounds, selection without handles, hover move cues |

The chart content is identical across the designs. The visual treatment, typography, hierarchy, canvas framing, toolbar placement, and component geometry vary. System fonts keep every preview available offline.

## Reviewing a direction

- The floating review bar links all twelve variants, the collection, the empty document, and the state specimens. These are prototype review controls, separate from the proposed app toolbar. The gallery leads with version 12; all earlier directions follow below. Side-by-side comparison initially shows version 12 against original Swiss Grid.
- **Weeks / Dates** changes chart labels through native radio inputs and CSS. Dates use the fixed specification example: Week 3 starts October 5, 2026; Week 0 starts September 14.
- **Empty / Example** switches between a populated chart and the initial one-section, one-row document. “Unnamed section” and “Unnamed row” are placeholders, not assigned names.
- Scroll below the editor for contextual menus, color inheritance, deletion confirmation, inline editing, collapse, creation, calendar setup, and collision studies.
- Browser scrolling and links work. The date input and inline text input are visual specimens. Zoom choices do not change scale. Drawing, dragging, resizing, scheduling, deletion, undo, and redo are intentionally unimplemented.

## Specification coverage

Source: [functional UX specification](../../docs/ux-specification.md).

| Requirement | Visual treatment in every direction |
| --- | --- |
| Direct editor without sign-in or setup | Editor opens immediately; no account or setup screen |
| Chart-dominant workspace; minimal toolbar | Undo, redo, zoom, Weeks / Dates only; no persistent property panel |
| Fixed Week 0 and negative weeks | Origin column, visible Weeks −2 through 9 |
| Whole-week periods and multiple bars per row | Week-aligned intervals, separate adjacent periods, shared example content |
| Week-ending milestones | Diamonds exactly on week boundaries; calendar specimen explains the final date |
| Single selection and resize handles | Only Exploration is selected. Versions 01–11 show end handles; version 12 deliberately removes them per your visual feedback and uses a grab cursor and subtle color change on hover |
| Empty creation discovery | Exact creation hint in the initial empty row |
| Add row / Add section placement | Add row follows each section’s last row; Add section follows the complete chart |
| Inline naming and context menus | Editable input specimen, bar menu, empty-space creation menu, row menu, section menu |
| Row/section reorganization and collapse | Name-area drag grips, collapse chevrons, collapsed-group specimen; positions preserved |
| Section color inheritance and item overrides | Matching inherited colors; Components uses an explicit override; compact palettes; no row color |
| Deletion confirmation | Section dialog shows rows/items affected; row specimen gives its scope; undo remains explicit |
| Continuous tracking and whole-week snapping | Solid pointer-following bar with dashed snapped preview specimen |
| Cascading collision pushes | Before/after A/B/C study preserves pushed-bar durations and documents reversal/undo |
| Calendar reference | Week 3 reference specimen; the sample calendar has seven-day increments |
| Navigation | Chart overflow supports horizontal scrolling; gesture hint shows Space-drag; zoom stays in the toolbar |

Behavioral acceptance scenarios require a later implementation. These studies depict the visual states; they do not implement chart behavior. The specification’s open edge cases remain open, particularly creation collisions, drag cancellation, minimum-duration ties, and milestone coexistence. No persistence, progress, dependency, export, or project-management features were added.

## Files and iteration

- `base.css`: common chart geometry and specimen controls.
- `themes.css`: six visual systems, each with its own shell composition and CSS tokens.
- `round-two.css`: four additional systems, each with a new shell composition; the original six do not load this file.
- `swiss-precision.css`: version 11, based on the supplied white/vermilion design reference.
- `swiss-grid-refined.css`: version 12, extending the original Swiss Grid with the requested typography, density, neutral Week 0, and selection refinements.
- `gallery.css`: comparison workspace, separate from the proposed app designs.
- `comparison.css`: generated CSS-only comparison selectors for all twelve directions.
- `build.py`: optional authoring utility that generates the HTML. It is not needed to view anything and runs only when regenerating pages. Edit HTML directly for quick exploration, or update the generator before rebuilding to retain changes.
- [Claude Design research](CLAUDE-DESIGN-RESEARCH.md): cited first-party findings and their local adaptation.

To regenerate: `python ui-prototypes/build.py`. No JavaScript is emitted. When a direction is selected, record the decision and implement it properly; these files are review artifacts, not production app code.

