---
description: Bootstrap docs for an SDK from scratch — comprehend source into the knowledge base, compose the guide from it, then review
argument-hint: '[SDK/runtime to document, or a guide path to (re)author from scratch]'
---

Bootstrap the full docs for: `$ARGUMENTS` (if empty, ask which SDK/runtime to document).

This is the **from-scratch path**: an SDK with no knowledge-base file yet, or a guide that must be
(re)authored from the ground up. It runs the expensive comprehension step once — reading source into
the knowledge base — then composes the guide from that base. For an SDK whose KB file already exists
and whose source merely changed, use **`/refresh-docs`** instead (it is far cheaper — it does not
re-comprehend the whole SDK).

The order matters: **knowledge first, guide second.** The guide is composed from verified facts, so
the facts must exist before the prose.

## 1. Comprehend source → knowledge base (sdk-knowledge-author)

Launch the `sdk-knowledge-author` agent in **bootstrap** mode for the SDK. It reads the SDK's
exported public surface under `packages/**/src`, creates the KB file from `_template.md` in the right
family dir (making a new sibling like `node/` or `native/` if needed), sets its `feeds-guides` marker
to the target guide, and fills every section with facts + grammar pointers. This is the one step that
reads source. It returns when `pnpm knowledge:check` passes for the new file.

## 2. Compose the guide from the knowledge base (guide-writer)

Launch the `guide-writer` agent for the target guide. It composes from the KB facts created in step 1
(reading facts, not re-grepping source) following the `optimization-guide-authoring` skill —
archetype, quick-start-then-deepen, `## Before you start`, copy-vs-adapt labels — grounded in the
matching reference implementation under `implementations/` for shape. If it finds it needs a fact the
base does not hold, it escalates back to `sdk-knowledge-author` rather than reading source itself.

## 3. Review loop (delegate to /review-guide)

Run the `review-guide` command on the guide. Two independent reviews run concurrently:

- **guide-newcomer-reviewer** — reads it cold as an average developer; reports undefined jargon,
  skim-mode, unperformable steps, dishonest labels.
- **guide-source-verifier** — checks every load-bearing claim traces to a KB fact (a lookup, not a
  source re-derivation). A claim with no backing fact is escalated to `sdk-knowledge-author`.

## 4. Gate before finishing

Do not call it done until all hold; loop back to the responsible step for anything unmet:

- Every newcomer **blocker** is fixed; friction items fixed or consciously accepted with a reason.
- Every verifier **contradicts-KB** claim is corrected; every **no-backing-fact** claim is resolved
  (fact added by the knowledge author, or claim removed).
- `pnpm knowledge:check` passes.
- `pnpm format:fix <touched paths>` leaves the guide clean and its TOC anchors resolve. Always pass
  the specific files you changed — never a bare `pnpm format:fix`, which reformats the whole tree and
  pulls unrelated files into your diff.

## 5. Funnel learnings back

Route each durable finding to the right artifact — never leave a persisted TODO:

- a reader-experience or structure rule → the `optimization-guide-authoring` skill (principles only);
- a fact → the knowledge base (via `sdk-knowledge-author` / `sdk-knowledge-maintenance`);
- a cross-guide consistency issue → **fix it now** in the affected guides; if shared wording was
  missing, add it once to `shared/`.

## 6. Report

Summarize: the KB file created and its facts, what the guide covers, each reviewer's findings and how
they resolved, what was funneled into the skill vs. the KB, and the validation result. Note anything
consciously deferred (e.g. Swift/Kotlin `#symbol` resolution for native SDKs).
