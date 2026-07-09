---
description: Author a new SDK guide or refresh an existing one end-to-end — writer, then newcomer + source-verification review, then funnel learnings back
argument-hint: '[SDK/runtime for a new guide, or an existing guide path to refresh]'
---

Drive the full guide lifecycle for: `$ARGUMENTS` (if empty, ask which SDK/runtime to document or
which guide to refresh).

This is one workflow with two entry points. First **classify the target**, then run the matching
path. Both paths end in the same review loop, so quality is identical whether a guide is new or
refreshed.

## 0. Classify: new vs. refresh

- If `$ARGUMENTS` names an existing file under `documentation/guides/`, or an SDK that already has a
  guide there → **refresh**.
- If it names an SDK/runtime with no guide yet → **new**.
- If ambiguous, list the guides in `documentation/guides/` and ask.

State which path you're taking and the target guide path before proceeding.

## 1. Draft (guide-writer)

Launch the `guide-writer` agent with the target and the path (new/refresh).

- **New:** it drafts the guide from the `optimization-guide-authoring` templates, grounded in the
  matching reference implementation under `implementations/` and reusing verified facts from the
  knowledge base (`documentation/internal/sdk-knowledge/`).
- **Refresh:** it first diffs the guide against the current authoring skill — the fastest tells are a
  missing `## Quick start` or `## Before you start`, a monolithic flow section, numbered headings, or
  missing `**Copy this:** / **Adapt this to your use case:**` labels — then brings the guide up to the
  current archetype and structure, preserving correct content.

The writer returns the edited guide path and a summary of what it changed.

## 2. Review loop (delegate to /review-guide)

Run the `review-guide` command on the target guide. It fans out the two independent reviews
concurrently and consolidates:

- **guide-newcomer-reviewer** — reads the guide cold as an average developer; reports undefined
  jargon, skim-mode, unperformable steps, dishonest labels.
- **guide-source-verifier** — proves every load-bearing SDK claim against source, reuses KB facts,
  and records newly verified facts back into the knowledge base. For an SDK whose KB family file does
  not exist yet, it CREATES it from `_template.md` as it verifies (following the
  `sdk-knowledge-maintenance` skill) — a new guide grows the KB.

## 3. Gate before finishing

Do not call the guide done until all of these hold; loop back to step 1 (writer) for anything unmet:

- Every newcomer **blocker** is fixed; friction items are fixed or consciously accepted with a reason.
- Every source-verifier **wrong/imprecise** claim is corrected against what the source actually does.
- `pnpm knowledge:check` passes (new/updated KB facts resolve).
- `pnpm format:fix` leaves the guide clean and its TOC anchors resolve.

## 4. Funnel learnings back (the loop that improves the system)

For each finding that reflects a durable rule rather than a one-off, route it to the right artifact —
never leave it as a persisted TODO:

- a reader-experience or structure rule → the `optimization-guide-authoring` skill (principles only,
  never SDK facts);
- a newly verified SDK fact → the knowledge base via `sdk-knowledge-maintenance`;
- a cross-guide consistency issue → **fix it now** in the affected guides and, if shared wording was
  missing, add it once to `shared/` (do not record it as drift to reconcile later).

## 5. Report

Summarize: new vs. refresh, what the writer changed, the findings from each reviewer and how each was
resolved, what was funneled into the skill vs. the KB, and the validation result. Note anything
consciously deferred and why.
