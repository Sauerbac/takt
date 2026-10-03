# Claude Design research and the local Takt adaptation

Researched on October 3, 2026. Sources below are first-party Anthropic material. This note describes the published workflow; it does not claim access to Claude Design's internal implementation.

## Verified workflow

Claude Design is an Anthropic product for generating visual work, including prototypes and mockups. Anthropic launched it on April 17, 2026 with an emphasis on exploring many directions, then refining them through conversation, comments, direct edits, and adjustment controls. Its launch description also says teams can maintain multiple design systems. [Anthropic launch announcement](https://www.anthropic.com/news/claude-design-anthropic-labs)

The current guide describes a conversation beside a preview canvas: bring a design system and context such as screenshots or a codebase, describe the intended design, inspect the result, iterate, then share or export. Chat supports broad changes and requests for alternative layouts, while canvas editing and comments support focused changes. The current guide documents design artifacts in conversations and Claude Code, while retaining the standalone experience. [Get started with Claude Design](https://support.claude.com/en/articles/14604416-get-started-with-claude-design)

A design system includes color, typography, components, and layout patterns. Claude can extract this from codebases, brand assets, documents, and examples. Its setup guide asks the designer to validate the generated system with a test project before publishing it for reuse. [Set up your design system](https://support.claude.com/en/articles/14604397-set-up-your-design-system-in-claude-design)

Anthropic's product-design tutorial explicitly recommends presenting multiple alternatives side by side. It describes importing a GitHub repository or local directory so prototypes use existing components and conventions. Handoff to Claude Code preserves design intent, component choices, and architectural context; the documented export bundles design files, conversation, and a README. It also recommends showing empty states and other relevant edge cases before implementation. [Claude Academy: prototypes and UX](https://academy.claude.com/tutorials/using-claude-design-for-prototypes-and-ux)

These sources describe an evolving product. The launch announcement is historical; current Help Center guidance takes priority for the present workflow. This prototype exercise only needs the exploration and review pattern, so subscription, integration, and account details are outside its scope.

## Local adaptation for this repository

The following is our design interpretation, not a claim about features supplied by Anthropic:

1. Treat [the Takt UX specification](../docs/ux-specification.md) as the common brief for every direction.
2. Put six alternatives in one local comparison gallery with links to full-size HTML previews. The gallery is the review workspace; the app previews remain uncluttered.
3. Give every direction a complete visual vocabulary: typography, spacing, palette, geometry, borders, toolbar, row hierarchy, chart bars, milestone markers, selection, and small overlays. Changing colors alone does not constitute a different design system.
4. Use the same chart content and corresponding screen states across all six options so the comparison assesses presentation fairly.
5. Document each direction's intent and CSS tokens. Once a direction is chosen, those files provide concrete implementation context and a starting point for iteration in this chat.

The requested artifacts are ordinary HTML and CSS, light mode only. They are visual prototypes. They do not provide AI generation, persistent comments, inline design editing, working chart manipulation, undo, or scheduling logic. Browser links and native HTML disclosure controls can make the review navigable without JavaScript.

## Takt constraints that govern the previews

The chart is the main editing surface. Its app toolbar contains only undo, redo, zoom, and the relative/calendar switch. Do not introduce document naming, account controls, a permanent properties sidebar, progress tracking, dependencies, export, or persistence features. Show Week 0 as the fixed origin, support negative weeks, depict milestones at week-ending boundaries, and place Add row after each section's rows and Add section below the complete chart. These requirements come from [the local UX specification](../docs/ux-specification.md).

Alongside a populated editor, include visual examples of the specified initial empty chart, selected/resizable bar, contextual actions and inherited colors, calendar reference, and row/section deletion confirmation. Static frames communicate the intended UI; the eventual app still needs to implement movement, snapping, collision pushes, animations, and undo behavior from the specification.
