---
description: Fast prose/structure/sequence iteration on a guide — recompose from the existing knowledge base and recipes, no source read, no fact re-verification
argument-hint: '[guide path + the phrasing/tone/sequence change, or a recipe/fragment edit to render]'
---

Iterate on a guide's **prose, structure, or sequence** and re-render it fast: `$ARGUMENTS` (if empty,
ask which guide and what to change).

This is the **tuning path**, and it is deliberately the cheapest of the docs commands. It exists for
the technical writer's tight loop: adjust phrasing, tone of voice, section order, an example label,
or a recipe/fragment's wording — then see the rendered guide — without re-running the whole pipeline.
**No source is read, no knowledge-base fact is re-derived, and no fact is re-verified**, because a
pure-prose change moves no fact. The knowledge base is taken as-is: current and true.

Use this when the change is editorial. If the change would alter what the guide **asserts** about the
SDK, stop and hand off (see the guardrail) — that is `/refresh-docs` (source changed) or
`/review-guide` (verify a claim against the base), not this command.

## What counts as in-scope (editorial)

- Rewording for clarity, tone, or voice; tightening or expanding an explanation.
- Reordering or re-sequencing sections; moving content between sections; changing what leads.
- Editing a recipe (`documentation/authoring/recipes/`) or fragment
  (`documentation/authoring/fragments/`) and re-rendering the guides that instantiate it.
- Changing an example-intent label's prose, a heading's wording (with its TOC anchor), or a
  transition.

## What is out of scope (a fact moved — hand off)

A change is out of scope the moment it alters a **factual claim**: a prop/config-key name or type, a
signature, a return shape, a default, a fallback/consent/dynamic-render behavior, an identifier's
ownership, an event name, or a cross-SDK semantic. These are the knowledge base's domain.

**Guardrail — hard stop.** If a requested edit would change what a sentence asserts about the SDK, do
NOT reword the claim, do NOT read source to check it, and do NOT launch `sdk-knowledge-author`. Stop
and tell the writer which command to use instead:

- the underlying SDK behavior actually changed → `/refresh-docs`,
- the guide's claim may be wrong and needs checking against the base → `/review-guide`.

Rewording that preserves the assertion is fine ("hands you back the variant" → "returns the variant"
is editorial); rewording that changes the assertion is not ("returns the variant" → "returns the
variant or null" asserts a new fact — stop).

## Steps

1. **Scope the change.** State the guide(s) affected and whether the edit is to the guide prose
   directly, or to a recipe/fragment that several guides instantiate (then all instantiating guides
   are in scope — find them by which archetype/fragment they use). Confirm the change is editorial;
   if any part trips the guardrail, name it and stop for that part.

2. **Recompose the affected prose (guide-writer).** Launch `guide-writer` scoped to the editorial
   change. It composes from the **existing** knowledge base (fills fragment slots and behavioral prose
   from current facts — never re-tracing source, never escalating a fact) and reads interface only if
   it must confirm a shape it is _rendering_ (not changing). If a recipe/fragment changed, it
   re-instantiates that fragment verbatim into each affected guide, filling slots from the current KB.
   It restructures and rewords per the `optimization-guide-authoring` skill and the archetype recipe;
   it does not alter factual claims.

3. **Validate cheaply.** `pnpm format:fix <touched guide paths>` (never bare) and confirm the
   collapsible TOC anchors still resolve. Run `pnpm knowledge:check` **only if** a recipe/fragment or
   KB-adjacent file was touched (it is fast and confirms nothing drifted); a pure guide-prose edit
   does not require it. Do NOT run the newcomer/source reviewers here — that is the final pass.

4. **Report.** The change made, the guides re-rendered, anything the guardrail sent to `/refresh-docs`
   or `/review-guide`, and the validation result. Remind the writer to run **`/review-guide`** as the
   final pass before shipping — that is where the newcomer + source-verification roles gate the
   result. This command is the fast inner loop; `/review-guide` is the gate.

## Relationship to the other docs commands

- `/author-guide` — bootstrap a new SDK's docs (reads source, builds the KB). Expensive.
- `/refresh-docs` — a source change (re-verifies affected facts, recomposes affected guides).
- **`/iterate-guide`** (this) — editorial tuning only (no source, no fact work). The inner loop.
- `/review-guide` — the final pass: newcomer + technical-foundation review, funnel-back, gate.
