---
name: sdk-knowledge-maintenance
description: >-
  Maintain the internal SDK knowledge base under documentation/internal/sdk-knowledge/ — the layer
  of verified SDK facts (symbols, props, cookies, config keys, return shapes) that each carry a
  source pointer into packages/**/src. Covers the three-artifact split (guides teach, this KB
  records verified facts, the authoring skill holds principles — facts never go in a skill), the
  _template.md skeleton every per-SDK file copies, and capturing shared facts once in shared/ so
  guide families reuse one canonical wording. Use when adding or editing a per-SDK
  knowledge file, recording an SDK API you just verified against source while doing other work,
  reading the KB before re-grepping the SDK, keeping it in sync after the SDK changes, or editing
  any file under documentation/internal/sdk-knowledge/. Triggers on "sdk knowledge", "internal
  knowledge base", "record verified facts", "source pointer". Not guide prose and not the authoring
  skill.
argument-hint: '[SDK to record or knowledge file to edit]'
paths: documentation/internal/sdk-knowledge/**
---

# Maintaining the internal SDK knowledge base

Use this skill whenever you add to, edit, or read the internal knowledge base under
`documentation/internal/sdk-knowledge/`. It owns the maintenance behavior that keeps that base a
trustworthy, verified fact store — so the practice survives beyond any single task. It does not
teach SDK facts (those live in the base) and it is not the guide-authoring skill.

Read the base's own `documentation/internal/sdk-knowledge/README.md` and
`documentation/internal/sdk-knowledge/_template.md` as the canonical source-of-truth for the
directory layout and the per-SDK section skeleton. This skill teaches the behavior; those files own
the exact shape.

## The three-artifact split

Three artifacts, three jobs. Keep each fact in exactly the right one.

- **The guides** (`documentation/guides/`) — public, teach-first prose for readers.
- **This knowledge base** (`documentation/internal/sdk-knowledge/`) — internal, verified SDK facts,
  each with a `source:` pointer. Terse notes, not prose.
- **The authoring skill** (`skills/optimization-guide-authoring`) — how to write good guides;
  transferable principles only.

The load-bearing rule: **if a fact names a concrete symbol, API, cookie, prop, config key, or return
shape, it belongs in the knowledge base (or a guide), never in a skill.** Skills hold principles;
the base holds facts. When you catch an SDK-specific fact drifting into a skill, move it here.

## Core maintenance behaviors

These are the transferable behaviors this skill exists to preserve.

- **Record the current state, not the history that produced it.** The base describes how the SDK
  works _now_, for a reader who does not know what it looked like before and does not need to. Never
  write change-ledger language: no "no longer", "now exports", "was removed", "used to", "gains",
  "newly added", "renamed from", "remains supported", PR/issue numbers, version-bump framing, or
  "this changed because…". State the fact plainly in the present tense. When the SDK changes, _edit
  the fact in place_ so it reads as if it were always true — do not append a note about the change
  or strike through the old value. (Genuine runtime conditionals — "after reading headers the route
  cannot use ISR" — are present-tense behavior, not history, and are fine.)
- **While the SDK is pre-release/alpha, record no SDK-version deltas.** One moving version means
  there is nothing to compare — do not note what a prior SDK version did, "upgrade to the fixed
  version", or version-to-version differences of this SDK. Record the single current version's facts
  in present tense. (Host-framework version facts the reader must act on today — e.g. a framework
  that resolves a handler differently across its own major versions — are present-state environment
  facts and are fine.) Revisit at the SDK's first major.
- **Every fact carries a `source:` pointer in the grammar.** Pointers are machine-checked by
  `pnpm knowledge:check`; the grammar is defined in the base's own `README.md#source-pointer-grammar`
  and is symbol-anchored — `<sdk>#<relpath>#<symbol>` (plus `impl:`, `concept:`, `kb:`, `extern:`),
  **never line numbers** (they drift). A fact without a resolvable pointer is a claim, not knowledge
  — do not add it. Never point a fact at a guide or "the accepted guide" to satisfy the rule; that is
  circular and the checker rejects it. Anchor on the symbol the fact is actually about.
- **Capture once, as a byproduct of verification.** When you verify an SDK API against source while
  doing other work (writing a guide, fixing a bug, answering a question), record what you confirmed
  here before the context is lost, with its grammar pointer. Do not run net-new verification passes
  just to fill the base in; do not re-derive a fact the base already holds.
- **Read the base before re-grepping the SDK.** It exists so authors and future regeneration reuse
  verified facts instead of re-searching `packages/**/src`. Check here first; only grep to confirm
  or extend.
- **Keep it in sync when the SDK changes.** If a symbol, prop, cookie, config key, export path, or
  return shape you touched is recorded here, update the entry and its `source:` pointer in the same
  change. Stale facts are worse than missing ones. `pnpm knowledge:check` runs in CI on every change
  to `packages/**/src`, so a rename that orphans a pointer fails the build on your PR — fix it here,
  do not wait for a follow-up.
- **Capture shared facts once, in `shared/`.** SDK-neutral concepts go in `shared/concepts.md`;
  canonical terms in `shared/vocabulary.md`. Per-SDK files link to them instead of restating them.
  This single canonical wording is _how_ a guide family stays consistent: guides reuse it rather than
  each paraphrasing the same fact.
- **Fix cross-guide drift when you find it; do not log it.** If a term, API name, or value that must
  match across a guide family has diverged, reconcile it now — correct the guide, and if the shared
  wording was missing, add it once to `shared/`. Do not keep a running list of known-broken things to
  reconcile later; an unfixed divergence is a bug, not a record. (A per-framework difference that is
  _correct_ — e.g. `NEXT_PUBLIC_` vs a Vite-style prefix — is not drift; state it as a fact in the
  relevant per-SDK file, not as a divergence to resolve.)

## Adding a new SDK file

1. Copy `_template.md` into the right family directory (e.g. `web/`, or a new sibling like `native/`
   when a family first needs one — do not create empty family dirs ahead of need).
2. Keep **every heading, in the template's order.** Fill each section with verified facts and
   `source:` pointers.
3. For a section with no entries for this SDK, keep the heading and write `None.` — never delete the
   heading.
4. Put anything shared with sibling SDKs in `shared/` and link to it; do not duplicate shared
   vocabulary or concepts into the per-SDK file.

## Not in scope

- **Guide prose** under `documentation/guides/` — reader-facing, teach-first; owned by the
  `optimization-guide-authoring` skill.
- **The authoring skill itself** — principles only; it must never accumulate SDK facts.
- **Concept docs** under `documentation/concepts/` and generated TypeDoc under `docs/`.
- **Committing** — review owns commits; do not git-commit the base as part of maintenance.

## Before you finish

- **`pnpm knowledge:check` passes.** This is the gate: it resolves every `source:` pointer against
  real files and symbols and enforces the grammar and template. Run it and fix every problem before
  finishing — do not leave the base in a state that fails the checker. If you touched `packages/**/src`
  in the same session, this also catches any recorded fact your change orphaned.
- Every new or changed fact has a resolvable `source:` pointer in the grammar (symbol-anchored, no
  line numbers, never pointing at a guide).
- Every entry reads as present-tense current state, with no change-ledger language ("no longer",
  "now", "was removed", "used to", PR/issue numbers, version-bump framing). Changes were edited in
  place, not appended as history.
- New per-SDK files match `_template.md` heading-for-heading, with `None.` for empty sections.
- Shared facts live once in `shared/` and are linked, not restated.
- Any cross-guide drift you noticed is fixed now (guide corrected, shared wording added to
  `shared/` if it was missing), not deferred.
- No SDK fact leaked into a skill; no reader-facing prose leaked into the base.
- Formatting is clean: `pnpm format:fix documentation/internal/sdk-knowledge`.
