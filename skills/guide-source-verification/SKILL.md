---
name: guide-source-verification
description: >-
  Verify that every load-bearing SDK claim in a documentation guide is true against the SDK source
  under packages/**/src — the technical-foundation review role. Confirms each hook, prop, config key,
  context field, return shape, cookie, and event name a guide asserts actually exists and behaves as
  described, with file:symbol evidence, then records what it verified into the internal knowledge base
  so the next guide reuses it. Use as the third authoring role (writer → newcomer reviewer →
  technical-foundation reviewer), after a guide is drafted or rewritten, or to fact-check a specific
  claim. Triggers on "technical review", "verify against source", "fact-check the guide", "is this API
  real", "foundation review". Not reader-experience review (guide-newcomer-review) and not prose
  authoring (optimization-guide-authoring).
argument-hint: '[guide file or claim to verify]'
paths: documentation/guides/**
---

# Verifying a guide against source

Every claim a guide makes about the SDK must be true against `packages/**/src`. Your job is to prove
it — API by API — and to leave behind verified facts the next guide can reuse instead of re-deriving.
You are the last line before a guide ships: a plausible-looking name is not proof it exists, and the
reference implementation proving one path works can still hide nuance.

## Method

1. **List the load-bearing claims.** Every hook, component, prop, config key, factory field, context
   field, return shape, cookie/identifier, event name, and behavioral assertion ("denied consent
   falls back to baseline", "server rendering forces dynamic") the guide states or shows in a snippet.
2. **Check the knowledge base first.** `documentation/internal/sdk-knowledge/` records facts already
   verified against source, each with a resolvable `source:` pointer. If a claim is already recorded
   and its pointer still resolves (`pnpm knowledge:check` passes), you can rely on it — do not
   re-grep. This is the point of the base: verification is not repeated.
3. **Verify the rest against source.** For each remaining claim, find the symbol in `packages/**/src`
   and confirm it exists and behaves as the guide says. Grep the export/type; read the implementation
   for behavior, not just the name. The matching reference implementation under `implementations/`
   shows one working path but can hide a factory field it does not use or a provider a bound component
   renders internally — the source is the authority.
4. **Resolve source-vs-impl disagreements toward source.** When the reference impl and the source
   seem to disagree, read the source and reconcile; the guide must match reality, and note the nuance.
5. **Record what you newly verified into the knowledge base.** As a byproduct — not a separate
   project — add each newly confirmed fact to the right per-SDK file (or `shared/`) using the pointer
   grammar, following the `sdk-knowledge-maintenance` skill. This is what closes the loop: the fact
   you verified for this guide is now reusable, and `pnpm knowledge:check` guards it against drift.

## How to report

Return a verdict per load-bearing claim:

- **Claim** — the exact assertion, with the guide location.
- **Verdict** — confirmed / wrong / imprecise / unverifiable.
- **Evidence** — `file:symbol` in `packages/**/src` (or the KB entry you relied on). For a wrong or
  imprecise claim, state what the source actually does.
- **KB action** — recorded new fact `X` in `web/<sdk>.md` (with pointer) / already held / n/a.

Flag wrong and imprecise claims to the writer to fix in the guide. Do not rewrite the guide yourself
— hand corrections back to `optimization-guide-authoring`.

## Before you finish

- Every load-bearing claim has a verdict backed by `file:symbol` evidence or a KB entry.
- Every fact you newly verified is recorded in the knowledge base with a grammar pointer, and
  `pnpm knowledge:check` passes.
- Wrong/imprecise claims are handed to the writer with what the source actually does.

## Not in scope

- **Reader-experience review** (undefined jargon, skim mode, performable steps) — that is
  `guide-newcomer-review`.
- **Prose authoring and structure** — that is `optimization-guide-authoring`.
- **Maintaining the knowledge base's format rules** — that is `sdk-knowledge-maintenance`; this skill
  uses it, and records facts, but does not own the grammar.
