---
description: Run the three-role authoring review on a documentation guide (newcomer + technical-foundation, then funnel learnings back)
argument-hint: '[guide file under documentation/guides/]'
---

Run the full authoring review loop on the guide: `$ARGUMENTS` (if empty, ask which guide under
`documentation/guides/`).

This runs standalone (review a guide that already shipped) and is also the review core that
`/author-guide` and `/refresh-docs` delegate to. When one of those workflows invokes it, this command
owns steps 1–5 in full — the workflow's own gate/funnel steps are the same loop, run once, not a
second pass. Do not review, fix, and funnel twice.

Do this in order:

1. **Newcomer review.** Launch the `guide-newcomer-reviewer` agent on the guide. It reads the guide
   cold as an average developer and returns reader-experience findings (undefined jargon, skim-mode,
   unperformable steps, dishonest labels), each with severity.

2. **Technical-foundation review.** Launch the `guide-source-verifier` agent on the guide. It splits
   each load-bearing claim into interface vs. behavior: interface (symbol/signature/prop/return shape)
   is checked directly against the types in `packages/**/src`; behavior (fallback, dynamic render,
   batching, defaults, ownership, cross-SDK semantics) is checked against the knowledge base and not
   re-traced from source. It returns per-claim verdicts (confirmed / contradicted / behavioral
   no-backing-fact). A behavioral claim with no backing fact is escalated to the `sdk-knowledge-author`.

   Run these two reviews concurrently — they are independent (one reads for the reader, one checks the
   guide's facts against the types and the knowledge base).

3. **Consolidate and fix.** Collect both agents' findings. Apply the guide fixes via the
   `guide-writer` agent (or directly, following `optimization-guide-authoring`): reader-experience
   fixes from the newcomer pass, and corrections for every claim the verifier marked contradicted
   (against the types for interface, the KB fact for behavior). For each **behavioral no-backing-fact**
   claim, resolve it: launch `sdk-knowledge-author` to trace and add the fact if the base should hold
   it, then recompose the claim from that fact — or remove the claim if nothing backs it.

4. **Funnel learnings back.** For each finding that reflects a durable rule — not a one-off — fold it
   into the right artifact:
   - a reader-experience or **voice/teaching** rule → the `optimization-guide-authoring` skill
     (principles only, never SDK facts),
   - an **archetype-wide structure or shared-prose** rule → the recipe or fragment under
     `documentation/authoring/` (the section spine, the category value set, and rules that hold for
     _every_ guide of the archetype → the archetype's recipe; a reusable sentence that drifted across
     the family → the relevant fragment's Template),
   - a **per-SDK editorial decision** — this SDK's section inventory, its order, or a specific
     section's integration category — → the SDK's blueprint
     (`documentation/authoring/blueprints/<sdk>.md`), with the reasoning. (The distinction: a rule
     true for the whole archetype is the recipe's; a judgment specific to how _this_ SDK's features
     arrange is the blueprint's.)
   - a missing or corrected SDK fact → the knowledge base via `sdk-knowledge-author`.

   When a fragment the recipe names is missing from the guide, or its fixed spine was reworded rather
   than instantiated verbatim, that is a structure finding: have the writer instantiate it.

5. **Validate.** Run `pnpm knowledge:check` (KB must pass) and `pnpm format:fix <touched paths>` —
   pass the specific files you changed, never a bare `pnpm format:fix` (it reformats the whole tree
   and pollutes the diff) — and confirm the guide's TOC anchors resolve.

Report: the findings from each role, what you changed in the guide, what you funneled back into the
skill vs. the knowledge base, and the validation result.
