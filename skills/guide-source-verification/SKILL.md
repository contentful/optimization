---
name: guide-source-verification
description: >-
  Verify a documentation guide's load-bearing SDK claims — the technical-foundation review role —
  splitting each into interface vs. behavior. Interface claims (symbol existence, signature, prop
  names/types, optionality, unions, return shape, import path) are checked directly against the types
  in packages/**/src — a cheap, self-verifying lookup. Behavioral claims (fallback contracts,
  dynamic-render forcing, batching, defaults, identifier ownership, cross-SDK semantics) are checked
  against verified facts in documentation/internal/sdk-knowledge/ and must NOT be re-traced from
  source; a behavioral claim with no backing fact is escalated to sdk-knowledge-authoring. Use as the
  third authoring role (writer → newcomer reviewer → technical-foundation reviewer), after a guide is
  drafted or refreshed, or to fact-check a specific claim. Triggers on "technical review", "verify
  against source", "fact-check the guide", "is this API real", "foundation review". Not reader-experience
  review (guide-newcomer-review) and not prose authoring (optimization-guide-authoring).
argument-hint: '[guide file or claim to verify]'
paths: documentation/guides/**
---

# Verifying a guide: interface against the types, behavior against the knowledge base

Every load-bearing claim a guide makes splits into two kinds, and each has its own authority:

- **Interface** — a symbol's existence, signature, prop/config-key names & types, optionality, union
  shape, return type, import path. The authority is the **types** — verify it directly against
  `packages/**/src` (or an editor's type view). This is a cheap, self-verifying lookup; reading source
  for interface is expected here, not forbidden.
- **Behavior** — what a call does: fallback contracts, denied-consent handling, dynamic-render
  forcing, batching/chunking, defaults, identifier ownership, cross-SDK semantics. The authority is
  the **knowledge base** (`documentation/internal/sdk-knowledge/`), which holds behavior already
  traced and verified. Confirm behavioral claims against the base — do **not** re-trace them from
  source; re-tracing is the expensive work the base exists to prevent.

So you read source freely for interface, and you rely on the base for behavior. The distinction is the
whole point: interface is O(1) and machine-checkable; behavior is expensive to derive and must not be
re-derived per review.

## Method

1. **List the load-bearing claims, and tag each interface or behavior.** Every hook, component, prop,
   config key, factory field, context field, return shape, cookie/identifier, event name, and
   behavioral assertion the guide states or shows in a snippet.
2. **Verify interface claims against the types.** Confirm the symbol exists and its shape (props,
   optionality, union, return) matches, directly in `packages/**/src`. A mismatch (a prop that does
   not exist, a wrong return shape) is a **guide bug** → correction to the writer.
3. **Verify behavioral claims against the base.** Find the fact in the relevant per-SDK file (or
   `shared/`) that backs the claim. `pnpm knowledge:check` must pass so its provenance pointer is
   structurally intact. Do not call that semantic re-verification: if the task includes source changes
   in the fact's behavior path, require the scoped knowledge-author review first. A claim the current,
   reviewed base contradicts is a guide bug.
4. **Escalate only a behavioral claim with no backing fact.** If a behavioral claim has no
   corresponding KB fact, do NOT trace it from source yourself — escalate to
   **`sdk-knowledge-authoring`**: either the base is missing a fact it should hold (the author traces
   and adds it), or the claim is unfounded (the author confirms nothing backs it, and it comes out of
   the guide). An unbacked _interface_ claim is not an escalation — you just checked it against the
   types in step 2. Record each escalation as a finding; the guide is not "verified" until the
   behavioral fact exists or the claim is removed.

The one time this review still leans on a fresh KB is a **bootstrap** guide whose SDK has no KB file
yet: it runs after `sdk-knowledge-authoring` has created the file, so behavior still checks against the
base, not against a fresh trace of your own.

## How to report

Return a verdict per load-bearing claim:

- **Claim** — the exact assertion, with the guide location, tagged interface or behavior.
- **Verdict** — confirmed / contradicted / no-backing-fact. For interface: confirmed or contradicted
  against the types. For behavior: confirmed or contradicted against a KB fact, or no-backing-fact.
- **Evidence** — for interface, the `file:symbol` in `packages/**/src`; for behavior, the KB fact and
  file (or "none found").
- **Action** — contradicted: the correction, handed to the writer. Behavioral no-backing-fact: an
  escalation to `sdk-knowledge-authoring` naming the claim.

Hand guide corrections to the writer (`optimization-guide-authoring`); hand behavioral fact gaps to
the knowledge author. Do not rewrite the guide and do not edit the knowledge base yourself.

## Before you finish

- Every interface claim is confirmed (or corrected) against the types; every behavioral claim is
  confirmed against a KB fact, corrected against one, or escalated.
- No **behavioral** claim was re-traced from source here — behavioral gaps went to
  `sdk-knowledge-authoring`. (Interface lookups against the types are expected and fine.)
- `pnpm knowledge:check` passes (so every behavioral fact you relied on is current).

## Not in scope

- **Tracing behavior from source to derive new facts** — that is `sdk-knowledge-authoring`. Escalate
  behavioral gaps; don't re-trace. (Reading the types to check an interface claim is in scope.)
- **Reader-experience review** (undefined jargon, skim mode, performable steps) — that is
  `guide-newcomer-review`.
- **Prose authoring and structure** — that is `optimization-guide-authoring`.
- **The knowledge base's format rules** — that is `sdk-knowledge-maintenance`.
