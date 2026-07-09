---
description: Run the three-role authoring review on a documentation guide (newcomer + technical-foundation, then funnel learnings back)
argument-hint: '[guide file under documentation/guides/]'
---

Run the full authoring review loop on the guide: `$ARGUMENTS` (if empty, ask which guide under
`documentation/guides/`).

Do this in order:

1. **Newcomer review.** Launch the `guide-newcomer-reviewer` agent on the guide. It reads the guide
   cold as an average developer and returns reader-experience findings (undefined jargon, skim-mode,
   unperformable steps, dishonest labels), each with severity.

2. **Technical-foundation review.** Launch the `guide-source-verifier` agent on the guide. It proves
   every load-bearing SDK claim against `packages/**/src` with `file:symbol` evidence, relies on the
   internal knowledge base for facts already verified, and records newly verified facts back into the
   KB. It returns a per-claim verdict.

   Run these two reviews concurrently — they are independent (one reads for the reader, one reads the
   source).

3. **Consolidate and fix.** Collect both agents' findings. Apply the guide fixes via the
   `guide-writer` agent (or directly, following `optimization-guide-authoring`): reader-experience
   fixes from the newcomer pass, and correctness fixes for every claim the verifier marked wrong or
   imprecise (using what the source actually does).

4. **Funnel learnings back.** For each finding that reflects a durable rule — not a one-off — fold it
   into the right artifact:
   - a reader-experience or structure rule → the `optimization-guide-authoring` skill (principles
     only, never SDK facts),
   - a newly verified SDK fact → the internal knowledge base via `sdk-knowledge-maintenance`.

5. **Validate.** Run `pnpm knowledge:check` (KB must pass) and `pnpm format:fix` on the touched files,
   and confirm the guide's TOC anchors resolve.

Report: the findings from each role, what you changed in the guide, what you funneled back into the
skill vs. the knowledge base, and the validation result.
