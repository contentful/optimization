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

## What belongs in the base: behavior, not the interface the types already hold

The type system is itself an always-current, machine-checked store of the SDK's **interface** — a
symbol's existence, signature, prop/config-key names and types, optionality, union shape, return
type, import path. Guide authors read that directly from source; they do not need the base for it,
and re-copying it here just duplicates something the compiler already guarantees.

Your job is the layer the types **cannot** express — **behavior** and semantics you can only learn by
reading implementation and control flow:

- what a call does on the edges: fallback contracts, denied consent, dynamic-render forcing, batching
  and chunking, error paths;
- identifier ownership — SDK-owned vs. reader-invented (a cookie name, an env var);
- defaults and their rationale;
- cross-SDK semantics (the same profile id another SDK reads);
- curation — which few config keys a reader actually sets, out of everything the type permits.

Anchor each such fact to the interface symbol it is about (that is the `source:` pointer, and it is
what lets the validator confirm the symbol still exists). But the fact's _content_ is the behavior,
not a restatement of the signature. When a fact would say nothing the type already says, it does not
belong here — point at the symbol and stop. Escalations you receive from guide authors are behavioral
by contract; if one is really an interface lookup, answer it, but it did not need the base.

## Two modes — pick by the trigger

### Bootstrap (a new SDK, or an SDK with no KB file yet)

Read the SDK's public surface once and record it. This is expensive and happens once per SDK; every
later change is incremental against what you leave behind.

1. Find the package and its `src/` root; read its `package.json` exports to learn the public entry
   points (the reader can only import what is exported — start there, not at internal files).
2. Walk the exported surface to discover behavior. Keep only a small symbol/import navigation index;
   do not copy config-key, prop, signature, or return shapes. Capture identifier ownership, event
   semantics, consent/persistence, runtime quirks, and failure/fallback behavior.
3. Copy `_template.md` into the right family dir (making a new sibling like `node/` or `native/` when
   the family is new), fill each section with facts + grammar pointers, set the `feeds-guides` marker
   to the guide(s) these facts compose into, and mark empty sections `None.`
4. Capture SDK-neutral facts in `shared/` once and link to them; do not restate them per SDK.

### Incremental (a source change — the common, cheap case)

The diff bounds the work. Do NOT re-read the whole SDK.

1. **Scope from the diff.** Facts whose pointers name a changed file are definitely at risk. Also
   inspect the changed symbol's public callers/exports far enough to catch behavioral facts anchored
   on an unchanged wrapper. `pnpm knowledge:check` catches renamed/removed pointer targets but not
   semantic changes.
2. **Re-verify only those facts** against the new source, and edit them in place (present tense, no
   change-ledger language — see `sdk-knowledge-maintenance`). A behavior that changed gets its fact
   rewritten; a symbol that moved gets its pointer re-anchored; a removed export gets its fact deleted.
3. **Capture what is genuinely new in the changed area** — new behavior or a new public symbol whose
   behavior a guide needs. Exact new interface shape remains in the types.
4. **Leave unrelated facts untouched.** Document the bounded caller/behavior path you inspected. Do
   not assume that a non-matching pointer alone proves a fact unrelated; make that determination from
   the changed dependency path.

## What a "fact" is (and is not)

A fact is a verified statement about current SDK behavior, carrying a provenance pointer into the
source. The pointer locates the verification target; it does not prove semantics merely by resolving.
The fact is terse, present-tense, and reader-relevant. It is NOT: guide prose, an example, a
tutorial step, detailed interface transcription, a rationale, or history. If it teaches or persuades,
it belongs in a guide.

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
