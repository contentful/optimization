---
description: Bootstrap docs for an SDK from scratch — comprehend source into the knowledge base, compose the guide from it, then review
argument-hint: '[SDK/runtime to document, or a guide path to (re)author from scratch]'
---

Bootstrap the full docs for: `$ARGUMENTS` (if empty, ask which SDK/runtime to document).

This is the **bootstrap path**, defined by one thing: **the SDK has no knowledge-base file yet.** The
expensive comprehension step — reading source into the KB — has never run for this SDK, so it runs
here, once. Use this whenever `documentation/internal/sdk-knowledge/<family>/<sdk>.md` does not exist.
For an SDK whose KB file already exists and whose source merely changed, use **`/refresh-docs`**
instead — it is far cheaper and does not re-comprehend the SDK.

**The guide itself may or may not already exist — handle both (step 2).** A brand-new SDK has no
guide (compose from scratch); a long-standing SDK often has a full guide that simply predates the
knowledge base (Node and React Native were both like this — 900+ lines each). Either way the KB comes
first: **knowledge first, guide second**, because the guide is composed from verified facts and the
facts must exist before the prose. When a guide already exists, step 2 is a reconciliation against the
now-authoritative KB, not a blank compose — do not expect an empty file.

## 1. Comprehend source → knowledge base (sdk-knowledge-author)

Launch the `sdk-knowledge-author` agent in **bootstrap** mode for the SDK. It reads the SDK's
exported public surface under `packages/**/src`, creates the KB file from `_template.md` in the right
family dir (making a new sibling like `node/` or `native/` if needed), sets its `feeds-guides` marker
to the target guide, and fills every section with facts + grammar pointers. This is the one step that
reads source. It returns when `pnpm knowledge:check` passes for the new file.

## 2. Compose or reconcile the guide from the knowledge base (guide-writer)

Launch the `guide-writer` agent for the target guide, working only from the KB facts created in step 1
(reading facts, not re-grepping source) and the `optimization-guide-authoring` skill — archetype,
quick-start-then-deepen, `## Before you start`, copy-vs-adapt labels — grounded in the matching
reference implementation under `implementations/` for shape. Two sub-cases:

- **Guide does not exist** — compose it from scratch against the template and the KB facts.
- **Guide already exists** (predates the KB) — reconcile it: bring it to the current archetype and
  make every SDK claim trace to a step-1 fact, preserving content that is still correct. This is the
  writer's "refresh an existing guide" job. Expect a full file, not a blank one.

If the writer needs a fact the base does not hold, it escalates back to `sdk-knowledge-author` rather
than reading source itself, using the escalation marker: an inline
`<!-- ESCALATE(sdk-knowledge-author): what fact is needed and where -->` HTML comment at the point of
use. The knowledge author adds the fact from source; the writer then composes the claim from it and
**removes the marker**. This is a transient handoff, never shipped — the gate below fails if any
`ESCALATE` marker remains, and so does `pnpm knowledge:check`.

## 3. Review, fix, and funnel back (delegate to the `review-guide` skill)

Invoke the **`review-guide`** skill (`.claude/commands/review-guide.md`) on the guide. It owns the
whole review loop in one pass — do not re-run it here:

- runs `guide-newcomer-reviewer` and `guide-source-verifier` concurrently (reader-experience findings;
  per-claim confirmed / contradicts-KB / no-backing-fact verdicts);
- consolidates and applies the fixes (guide corrections; no-backing-fact claims resolved by having
  `sdk-knowledge-author` add the fact from source, or the claim removed);
- funnels durable findings back — reader/structure rules to the `optimization-guide-authoring` skill,
  facts to the knowledge base, cross-guide consistency issues fixed now (never logged);
- validates (`pnpm knowledge:check`; `pnpm format:fix <touched paths>`, never bare).

## 4. Bootstrap gate

`review-guide` runs its own gate; these are the extra checks specific to a from-scratch bootstrap.
Do not finish until they hold:

- The new KB file conforms: matches `_template.md`, has a `feeds-guides` marker, empty sections marked
  `None.`, and `pnpm knowledge:check` passes for it.
- **No `ESCALATE` marker remains** in the guide — every escalation was resolved and its marker removed
  (`pnpm knowledge:check` fails on a survivor).
- The guide is on the current archetype (Quick start, Before you start, category-ordered sections),
  and its TOC anchors resolve.

## 5. Report

Summarize: the KB file created and its facts, what the guide covers, each reviewer's findings and how
they resolved, what was funneled into the skill vs. the KB, and the validation result. Note anything
consciously deferred (e.g. Swift/Kotlin `#symbol` resolution for native SDKs).
