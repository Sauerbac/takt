# Reviewing the Takt agent guide

Research date: October 3, 2026. This is a recommendation; the existing guide has not been changed.

## What official guidance supports

Codex loads repository instructions into its starting context. Root instructions apply broadly; more specific directories can provide narrower guidance. The documented default discovery cap is 32 KiB across instruction files, which is a technical limit rather than a recommended document length. The official guide's examples keep repository expectations small. [OpenAI: Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)

OpenAI recommends revisiting always-applicable instructions and making documentation pointers conditional on the task. Its example routes architecture, database, and deployment work to their respective documents instead of requiring all documents before every edit. The advice about reducing redundant testing prompts is explicitly about GPT-6 Astra; it does not override Takt's agreed automated acceptance contract. [OpenAI: Rethinking skills and prompts for GPT-6 Astra](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)

A first-party example puts one routing instruction in AGENTS.md and keeps the detailed planning contract in a separate file. This cookbook recipe is now archived, so it illustrates document organization rather than current model guidance. [OpenAI: Using PLANS.md for multi-hour problem solving](https://developers.openai.com/cookbook/articles/codex_exec_plans)

None of these sources establishes a universal line or word limit. The proposed length below is a judgment for this repository.

## Takt-specific recommendation

The current [AGENTS.md](../../AGENTS.md) is 55 lines, approximately 798 whitespace-delimited words, and 7,170 bytes. The line count understates its reading cost because several lines are long paragraphs. Aim for about 10–15 substantive lines and roughly 200 words, keeping the essential contract and routing the remaining reference material to existing documents.

| Current material                                                                                             | Recommended home                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conditional pointers to UX, implementation decisions, and prototype                                          | Keep in AGENTS.md. These already express useful task boundaries.                                                                                                                                                     |
| Technical direction, motion rules, vertical-slice sequence, and deferred scope                               | Keep their authoritative versions in implementation-decisions.md; remove the summaries from AGENTS.md.                                                                                                               |
| Command catalogue, setup, test ports, Windows sandbox caveat, screenshot update command and platform details | Move to README's browser-application section. Keep the completion command sequence in AGENTS.md. README currently points back to AGENTS.md for individual scripts; update that pointer during relocation.            |
| Concrete module ownership                                                                                    | Record next to the architecture in implementation-decisions.md, using full repo-relative paths such as apps/web/src/model. Current root-guide paths such as src/model require readers to infer the workspace prefix. |
| Editor initialization contract                                                                               | Already documented immediately above History construction in Editor.svelte. Keep that local contract; remove its duplicate from AGENTS.md.                                                                           |
| Fixture locations and real-pointer/motion testing techniques                                                 | Keep fixture instructions in README; put testing conventions beside the automated verification contract in implementation-decisions.md.                                                                              |
| Automated acceptance, unresolved product behavior, and guide maintenance                                     | Keep one concise rule each in AGENTS.md.                                                                                                                                                                             |

This is documentation cleanup, not a demonstrated runtime defect. The duplication creates maintenance risk: commands and interaction rules can diverge from package scripts or their authoritative specifications. The existing conditional spec pointers are appropriate; replacing them with a blanket requirement to read every document would increase unnecessary work.

## Candidate compact guide

Relocate the operational details above before adopting this version. Preserve the project's agreed behavior and completion checks.

```md
# Takt agent guide

Takt is a desktop-browser Gantt editor. The browser app lives in apps/web.

- Before changing product behavior, read docs/ux-specification.md. For architecture, interactions, components, or test coverage, also read docs/implementation-decisions.md; it records the later agreed interaction decisions.
- Use ui-prototype/ as the visual reference. It is static prototype code, not production code to port wholesale.
- Use npm from the repository root and commit the root package-lock.json. See README.md for setup, individual commands, fixtures, and browser-test caveats.
- Complete changes with npm run format:check, npm run check, npm run build, then npm test. Build before running the integrated production tests.
- An interaction is complete only when its agreed behavior has automated coverage, including visual and motion checks where required by the implementation decisions.
- If product behavior is unresolved in the specifications and code, ask the user before choosing it.
- Keep this guide concise and current. Put detailed behavior in the specifications, development instructions in README.md, and local contracts near their code.
```

No additional nested AGENTS.md is needed yet: this repository has one small production application, and the existing specifications already provide useful places for the reference material.
