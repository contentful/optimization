---
name: sdk-knowledge-authoring
description: >-
  Derive verified SDK facts from source into the internal knowledge base under
  documentation/internal/sdk-knowledge/ — the comprehension step of the docs pipeline. This is the
  one expensive step that reads packages/**/src; the knowledge base memoizes it so guides and reviews
  read facts instead of re-comprehending code. Two modes: BOOTSTRAP (read an SDK's whole public
  surface into a new KB file, once) and INCREMENTAL (a source change → re-verify only the facts whose
  pointers hit the changed files, plus capture new/removed exports in that area). Use when a source
  PR touches packages/**/src, when a new SDK needs a KB file, or when a guide/review escalates a
  missing fact. Triggers on "update the knowledge base from source", "source changed", "bootstrap KB",
  "which facts changed", "capture new exports". Not guide prose (optimization-guide-authoring), not
  the format rules (sdk-knowledge-maintenance), not reader review (guide-newcomer-review).
argument-hint: '[SDK to bootstrap, or changed source paths to reconcile]'
paths: packages/**/src/**
---

# Authoring SDK knowledge from source

You perform the **comprehension** step of the docs pipeline: reading `packages/**/src` and writing
what is true into the knowledge base. Think of it as compiling source into an intermediate
representation — the knowledge base is that IR, and it exists so the expensive act of understanding
the code happens **once and is memoized**, not repeated by every guide author and every reviewer.

```
   SOURCE ───▶ [ you: comprehension ] ───▶ KNOWLEDGE BASE ───▶ guides, reviews (read facts, not code)
   packages/src        (expensive)          (verified facts)          (cheap)
```

You own the source→KB direction only. You do not write guide prose, you do not own the pointer
grammar (that is `sdk-knowledge-maintenance` — follow it for how a fact is shaped and pointed), and
you do not review guides. You produce and update facts.

## Two modes — pick by the trigger

### Bootstrap (a new SDK, or an SDK with no KB file yet)

Read the SDK's public surface once and record it. This is expensive and happens once per SDK; every
later change is incremental against what you leave behind.

1. Find the package and its `src/` root; read its `package.json` exports to learn the public entry
   points (the reader can only import what is exported — start there, not at internal files).
2. Walk the exported surface: factory/init functions and their config keys, components/hooks and
   their props/returns, identifiers (cookies, headers, storage keys, env vars) and who owns them,
   events and their semantics, consent/persistence model, runtime quirks, failure/fallback behavior.
   The `_template.md` sections are the checklist of what to capture.
3. Copy `_template.md` into the right family dir (making a new sibling like `node/` or `native/` when
   the family is new), fill each section with facts + grammar pointers, set the `feeds-guides` marker
   to the guide(s) these facts compose into, and mark empty sections `None.`
4. Capture SDK-neutral facts in `shared/` once and link to them; do not restate them per SDK.

### Incremental (a source change — the common, cheap case)

The diff bounds the work. Do NOT re-read the whole SDK.

1. **Scope from the diff.** Take the changed files under `packages/**/src`. The facts at risk are
   exactly those whose `source:` pointer names a changed file — `pnpm knowledge:check` resolves every
   pointer, so a pointer that now fails to resolve is a renamed/removed symbol you must fix. Grep the
   KB for pointers into the changed files to find the rest.
2. **Re-verify only those facts** against the new source, and edit them in place (present tense, no
   change-ledger language — see `sdk-knowledge-maintenance`). A behavior that changed gets its fact
   rewritten; a symbol that moved gets its pointer re-anchored; a removed export gets its fact deleted.
3. **Capture what is genuinely new in the changed area** — a new exported config key, prop, or event
   that a guide would need to mention. Judge newness against the changed surface, not the whole SDK;
   do not open a net-new comprehension pass of unrelated code.
4. **Leave everything else untouched.** A fact whose pointer does not touch the diff is still true;
   re-verifying it is wasted comprehension, which is the cost this whole design exists to avoid.

## What a "fact" is (and is not)

A fact is a verified statement about the current SDK, carrying a grammar pointer into the source that
proves it. It is terse, present-tense, and reader-relevant. It is NOT: guide prose, an example, a
tutorial step, a rationale, or a history of how the code got here. If it names a concrete
symbol/prop/cookie/config key/return shape, it belongs here; if it teaches or persuades, it belongs
in a guide.

## Handing off

- When you finish, the affected guides (named by each touched file's `feeds-guides` marker) may need
  recomposing. That is the guide-composition step's job, not yours — report which guides your changes
  affect so the pipeline can scope the guide update.
- Non-TypeScript SDKs: `#symbol` resolution is checked via the TypeScript compiler, so it applies to
  TS-source SDKs (Node, React Native, web). For Swift (iOS) or Kotlin (Android) source, use
  file-level `<sdk>#<relpath>` pointers (no `#symbol`) and say so — do not invent an unverifiable
  symbol anchor.

## Before you finish

- Every fact you added or changed has a resolvable grammar pointer; `pnpm knowledge:check` passes.
- Incremental: you touched only facts in the diff's blast radius; you did not re-verify unrelated
  facts or open an unscoped comprehension pass.
- Bootstrap: the new file matches `_template.md` heading-for-heading, has a `feeds-guides` marker, and
  marks empty sections `None.`
- You reported which guides the change affects (via `feeds-guides`) for the composition step.
- No guide prose leaked into the base; no fact leaked into a skill.
