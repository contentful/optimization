---
description: Incrementally update docs after a source change — reconcile only the affected knowledge-base facts, then recompose only the guides that consume them
argument-hint: '[changed source paths, a base git ref to diff, or empty to use the working-tree diff]'
---

Incrementally refresh the docs for a source change: `$ARGUMENTS` (if empty, use the current diff
against `main` — `git diff --name-only main...HEAD` plus unstaged changes under `packages/**/src`).

This is the **steady-state path**, and it is deliberately cheap. It does NOT re-comprehend an SDK or
recompose whole guides. The diff bounds the work: only the knowledge-base facts the change touches
get re-verified, and only the guides that consume those facts get recomposed. If a change turns out
to need a brand-new KB file (a new SDK, or a guide that was never authored the current way), stop and
use **`/author-guide`** instead — that is the bootstrap path. If nothing about the SDK changed and the
edit is purely editorial — phrasing, tone, section order, a recipe/fragment wording — use
**`/iterate-guide`** instead; it skips all fact work and just re-renders the prose.

## 1. Scope from the diff (deterministic — no agent)

Determine the changed files under `packages/**/src`. Then find what depends on them, in both
directions of the graph:

- **Affected KB facts** — facts whose `source:` pointer names a changed file. `pnpm knowledge:check`
  resolves every pointer, so run it first: any pointer that now fails to resolve is a
  renamed/removed/moved symbol the change broke. Also grep the KB for pointers into the changed files
  to catch facts whose behavior changed even though the symbol still resolves.
- **Affected guides** — the `feeds-guides` marker of each KB file that holds an affected fact names
  the guide(s) that consume it. That is the recompose set.

State the changed files, the affected facts, and the affected guides before proceeding. If nothing is
affected (the change touched no documented surface), say so and stop — there is nothing to refresh.

## 2. Reconcile the knowledge base (sdk-knowledge-author, incremental mode)

Launch the `sdk-knowledge-author` agent in **incremental** mode, scoped to the changed files. It
re-verifies only the affected facts against the new source, edits them in place (present tense, no
change-ledger language), captures genuinely new exports in the changed area, and deletes facts for
removed exports. It leaves untouched facts alone. It returns when `pnpm knowledge:check` passes and
reports which facts changed and — via `feeds-guides` — which guides that affects.

## 3. Recompose only the affected guides (guide-writer)

For each affected guide, launch `guide-writer` to update **only the passages that depend on a changed
fact**, composing from the reconciled KB (not re-reading source, not rewriting the whole guide).
A fact that changed shape/behavior means the snippet or sentence that used it changes; an unaffected
section is left as-is.

If the change **adds or removes a documented capability** (a new feature the guide should now cover,
or a removed one it should drop), the SDK's blueprint
(`documentation/authoring/blueprints/<sdk>.md`) needs a matching Section map change before the guide
gains or loses that section. Update “Must teach or show” when the changed capability alters what the
reader must see. A pure behavioral change that leaves the teaching contract intact changes only the KB
and guide.

## 4. Review only what changed (delegate to the `review-guide` skill, scoped)

Invoke the **`review-guide`** skill on each recomposed guide — it owns the review/fix/funnel/validate
loop in one pass; do not re-run those steps yourself. Focus the reviewers on the changed passages:

- **guide-source-verifier** — confirm the changed claims now trace to the reconciled KB facts.
- **guide-newcomer-reviewer** — confirm the changed passages still read cleanly for a newcomer (a
  changed snippet can reintroduce undefined jargon or a broken step).

## 5. Gate

`review-guide` runs its own gate; this adds what is specific to an incremental refresh:

- Every changed claim traces to a current KB fact; no newcomer blocker in the changed passages.
- No `ESCALATE` marker remains in any touched guide.
- `pnpm knowledge:check` and `pnpm guides:check` pass;
  `pnpm exec prettier --write <touched paths>` leaves the touched guides clean; TOC anchors resolve.

## 6. Report

Summarize: the changed source, the facts reconciled (added/changed/removed), the guides recomposed
and which passages, the review outcome, and validation. Explicitly list any documented surface you
concluded was NOT affected, so the reader can trust the scoping was deliberate, not missed.
