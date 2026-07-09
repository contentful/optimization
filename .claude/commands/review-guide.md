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

2. **Technical-foundation review.** Launch the `guide-source-verifier` agent on the guide. It checks
   that every load-bearing SDK claim traces to a verified fact in the knowledge base (a lookup, not a
   source re-derivation), and returns a per-claim verdict: confirmed / contradicts-KB / no-backing-fact.
   A claim with no backing fact is escalated to the `sdk-knowledge-author` (which owns reading source),
   not verified against source here.

   Run these two reviews concurrently — they are independent (one reads for the reader, one checks the
   guide against the knowledge base).

3. **Consolidate and fix.** Collect both agents' findings. Apply the guide fixes via the
   `guide-writer` agent (or directly, following `optimization-guide-authoring`): reader-experience
   fixes from the newcomer pass, and corrections for every claim the verifier marked contradicts-KB
   (using the KB fact as the authority). For each **no-backing-fact** claim, resolve it: launch
   `sdk-knowledge-author` to add the fact from source if the base should hold it, then recompose the
   claim from that fact — or remove the claim if nothing backs it.

4. **Funnel learnings back.** For each finding that reflects a durable rule — not a one-off — fold it
   into the right artifact:
   - a reader-experience or structure rule → the `optimization-guide-authoring` skill (principles
     only, never SDK facts),
   - a missing or corrected SDK fact → the knowledge base via `sdk-knowledge-author`.

5. **Validate.** Run `pnpm knowledge:check` (KB must pass) and `pnpm format:fix <touched paths>` —
   pass the specific files you changed, never a bare `pnpm format:fix` (it reformats the whole tree
   and pollutes the diff) — and confirm the guide's TOC anchors resolve.

Report: the findings from each role, what you changed in the guide, what you funneled back into the
skill vs. the knowledge base, and the validation result.
