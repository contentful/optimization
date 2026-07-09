---
name: guide-source-verification
description: >-
  Verify that every load-bearing SDK claim in a documentation guide traces to a verified fact in the
  internal knowledge base — the technical-foundation review role. In steady state this is a cheap
  lookup against documentation/internal/sdk-knowledge/, NOT a re-derivation from source: the knowledge
  base already holds source-verified facts, so a guide claim is trustworthy when it matches one. A
  claim with no backing fact is escalated to sdk-knowledge-authoring (which owns reading source), not
  re-verified here. Use as the third authoring role (writer → newcomer reviewer → technical-foundation
  reviewer), after a guide is drafted or refreshed, or to fact-check a specific claim. Triggers on
  "technical review", "verify against the knowledge base", "fact-check the guide", "does this trace to
  a fact", "foundation review". Not reader-experience review (guide-newcomer-review) and not prose
  authoring (optimization-guide-authoring).
argument-hint: '[guide file or claim to verify]'
paths: documentation/guides/**
---

# Verifying a guide against the knowledge base

Every load-bearing claim a guide makes about the SDK must trace to a verified fact in the knowledge
base (`documentation/internal/sdk-knowledge/`). That base already holds facts checked against source,
each with a resolvable pointer — so your job in steady state is a **consistency lookup**, not a
re-derivation. You confirm the guide says what the base says. You do not re-read `packages/**/src`
yourself; comprehension is the knowledge author's job, and re-doing it here is exactly the wasted work
the knowledge base exists to prevent.

## Method

1. **List the load-bearing claims.** Every hook, component, prop, config key, factory field, context
   field, return shape, cookie/identifier, event name, and behavioral assertion the guide states or
   shows in a snippet.
2. **Trace each to a KB fact.** Find the fact in the relevant per-SDK file (or `shared/`) that backs
   the claim. A claim is **confirmed** when the base holds a matching fact and `pnpm knowledge:check`
   passes (its pointer resolves, so it is current). This is the fast path and should cover almost
   everything for an SDK whose KB file exists.
3. **Compare wording against the fact.** If the guide asserts something narrower, broader, or simply
   different from the fact (a prop that does not exist in the fact, a return shape stated wrong, a
   behavior the fact contradicts), that is a **guide bug** — the base is the authority. Flag it for
   the writer with the correct fact.
4. **Escalate a claim with no backing fact.** If a load-bearing claim has no corresponding KB fact,
   do NOT verify it against source yourself. Escalate to **`sdk-knowledge-authoring`**: either the
   base is missing a fact it should hold (the author adds it from source), or the claim is unfounded
   (the author confirms nothing backs it, and it comes out of the guide). Record the escalation as a
   finding; the guide is not "verified" until the fact exists or the claim is removed.

The one time you legitimately drive source comprehension is a **bootstrap** guide whose SDK has no KB
file yet — there is nothing to look up. In that case this review runs after `sdk-knowledge-authoring`
has created the KB file, so you are still checking guide-against-KB, not guide-against-source.

## How to report

Return a verdict per load-bearing claim:

- **Claim** — the exact assertion, with the guide location.
- **Verdict** — confirmed (matches a KB fact) / contradicts-KB / no-backing-fact.
- **Evidence** — the KB fact and file that backs it (or "none found").
- **Action** — for contradicts-KB: the correction, handed to the writer. For no-backing-fact: an
  escalation to `sdk-knowledge-authoring` naming the claim.

Hand guide corrections to the writer (`optimization-guide-authoring`); hand fact gaps to the
knowledge author. Do not rewrite the guide and do not edit the knowledge base yourself.

## Before you finish

- Every load-bearing claim is confirmed against a KB fact, corrected against one, or escalated.
- No claim was silently re-verified against source here — gaps went to `sdk-knowledge-authoring`.
- `pnpm knowledge:check` passes (so every fact you relied on is current).

## Not in scope

- **Reading source to derive facts** — that is `sdk-knowledge-authoring`. Escalate, don't re-derive.
- **Reader-experience review** (undefined jargon, skim mode, performable steps) — that is
  `guide-newcomer-review`.
- **Prose authoring and structure** — that is `optimization-guide-authoring`.
- **The knowledge base's format rules** — that is `sdk-knowledge-maintenance`.
