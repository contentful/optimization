---
name: optimization-guide-authoring
description: >-
  Author or revise a public documentation guide under documentation/guides/ for the Optimization SDK
  Suite. Covers the guide archetypes (integration, decision, supplemental recipe), the teach-first
  quick-start-then-deepen structure, the copy-vs-adapt example labels, the guides directory routing
  index, and the self-review checklist that keeps guides consistent. Use when writing a new
  integration guide, rewriting an existing one, adding a decision or recipe guide, editing the
  guides README index, reviewing a guide for structure and voice, or editing any file under
  documentation/guides/. Triggers on "write a guide", "integration guide", "getting started guide",
  "documentation/guides", "choosing-the-right-sdk", "guide archetype", "quick start", "rewrite the
  guide", "guide TOC", "Copy this / Adapt this". Not for concept docs under documentation/concepts
  (those own deeper mechanics), not for package or implementation READMEs, and not for generated
  TypeDoc under docs/.
argument-hint: '[guide file or SDK to document]'
paths: documentation/guides/**
---

# Authoring Optimization SDK guides

Use this skill whenever you create, rewrite, or review a guide under `documentation/guides/`. It
owns the **voice, teaching approach, and authoring workflow** for those guides so they stay
consistent and teachable. It supersedes the former long-form rules in
`documentation/guides/AGENTS.md`, which is now a thin pointer to this skill.

**Authoring structure lives under `documentation/authoring/`, not here.** The recipe owns the
archetype-wide spine and rules; the SDK blueprint owns the quick-start proof, section map, categories,
and teaching priorities; shared-copy files hold small pieces of reusable wording. This skill owns voice and
workflow. Do not infer a guide from siblings, and do not let SDK facts leak into recipes, blueprints,
shared copy, or this skill.

## Who the guides are for

Write for **an average developer with little or no personalization background**. The reader should
be able to open a guide cold, understand just enough to act, and reach a working result fast — then
go deeper. Two consequences drive everything below:

- **Teach before you use.** Define a term in plain language the first time it appears. Never open
  with a dense sentence that stacks unexplained jargon ("server optimization state handoff after
  browser takeover"). A newcomer must not need the concept docs to get a first result.
- **Sequence over completeness.** Reveal the picture in order. Do not front-load the full production
  surface. Anything a section will teach later must not appear before the reader needs it.
- **Plain, not chatty.** Be direct and warm, but avoid informal filler and hype that reads oddly in
  a reference doc ("this is the payoff", "the magic happens here", "boom", "just"). Say what the
  section does plainly ("This is where personalization happens"). A sentence should still make sense
  read aloud in a technical review.
- **Describe the current SDK, not its history.** The reader opens the guide cold and does not know
  what the SDK looked like before. Write in the present tense and never narrate change: no "no
  longer", "now supports", "was removed", "used to", "newly added", "renamed from", PR/issue
  numbers, or version-bump framing. When the SDK changes, revise the affected prose in place so it
  reads as if it were always this way. (A `## Troubleshooting` row describing a present symptom and
  its fix — e.g. a build error and how to resolve it — is current-state guidance, not history, and
  is fine.)

## Scope

- Guides under `documentation/guides/`: `integrating-*.md`, `choosing-the-right-sdk.md`,
  supplemental recipe guides, and the directory `README.md` routing index.
- This skill owns teaching voice, the copy-vs-adapt honesty principle, and the authoring workflow.
  Archetype structure belongs to recipes, per-SDK arrangement to blueprints, and reusable wording to
  shared copy under [`documentation/authoring/`](../../documentation/authoring/).

## Not in scope

- **Guide structure** — the recipe owns the archetype spine and category values; the SDK blueprint
  owns its `###` inventory/order/category and what each section must teach or show. Shared wording lives
  in `documentation/authoring/fragments/`. Open both recipe and blueprint before drafting.
- Concept docs under `documentation/concepts/` — they own deeper mechanics; guides link to them.
- Package READMEs, implementation READMEs, and product docs.
- Generated TypeDoc under `docs/` — it owns exhaustive, method-by-method API reference.
- Prose style mechanics — follow the repo `STYLE_GUIDE.md`; let Prettier own formatting.

## Archetypes and structure

Every guide has exactly one primary archetype. Pick it by the reader's primary goal, then open the
matching recipe under [`documentation/authoring/recipes/`](../../documentation/authoring/recipes/) —
the recipe's `## Template` is the section spine and its `## Context` is the structural rationale.

| Reader goal                                                   | Archetype           | Recipe                                                                                                                       |
| ------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Integrate an SDK into a specific runtime (`integrating-*.md`) | Integration guide   | [../../documentation/authoring/recipes/integration.md](../../documentation/authoring/recipes/integration.md)                 |
| Choose between SDKs, runtimes, or patterns                    | Decision guide      | [../../documentation/authoring/recipes/decision.md](../../documentation/authoring/recipes/decision.md)                       |
| Supplement an integration without replacing it                | Supplemental recipe | [../../documentation/authoring/recipes/supplemental-recipe.md](../../documentation/authoring/recipes/supplemental-recipe.md) |

The recipe owns the fixed `##` order, the `**Integration category:**` values, the
`## Before you start` shape, labels, and shared-copy placement. For an integration guide, the SDK
blueprint supplies the exact `###` map and completeness contract. Do not read sibling guides to infer
either.

## Example labels: make copy-vs-adapt honest

The recipe defines the label set and per-label rules. The transferable principle this skill owns: an
example label is a **promise to the reader — keep it true.** `**Copy this:**` only when the values
actually work as-is against what the guide points to; the moment a snippet needs relocation or
structural change, it is `**Adapt this to your use case:**` and the guide names what is the reader's
vs. the pattern to copy. Add short comments only for SDK-specific lines that carry meaning (lifecycle
placement, consent, event sequencing, fallback, duplicate-event prevention); never narrate obvious
syntax.

## Directory README (routing index)

Keep `documentation/guides/README.md` a lightweight router only. Use concise fields — `Guide`,
`Runtime or app type`, `Package`. No fastest-path columns, setup summaries, tradeoff matrices, or
procedure previews. Put package tradeoffs in `choosing-the-right-sdk.md` and runnable paths in the
integration guides. Keep the listing order: Node, Web, React Web, Next.js App Router, Next.js Pages
Router, React Native, iOS SwiftUI, iOS UIKit, Android Compose, Android Views.

## Workflow

1. **Identify the archetype and reader goal.** Open the matching recipe. For an integration guide,
   also open `documentation/authoring/blueprints/<sdk>.md`. The recipe supplies the `##` spine; the
   blueprint's Section map supplies every `###` in order and the teaching goal for each section.
2. **Draft the intro and quick start first.** Instantiate the `personalization-explainer` using only
   the switches in the blueprint. Take the quick-start outcome, verification, reader shape, required
   artifacts, and deliberate simplifications from the blueprint. Keep optional concerns out unless
   the proof requires them.
3. **Write `## Before you start`** as an outside-the-guide prerequisites list, including the
   shared `authored-variant-gotcha` copy (mandatory) so the reader can tell personalization from a bug.
4. **Fill feature sections in blueprint order**, each with its exact category and everything its
   “Must teach or show” cell asks for. Use the linked KB sections for behavior and the package types
   for exact interface shape.
5. **Split every SDK claim into interface vs. behavior, and source each from the right place.** These
   are two different kinds of fact with two different costs, and the rule differs:
   - **Interface** — what you'd see in a `.d.ts` or an editor hover: a symbol's existence, its
     signature, prop/config-key names and types, optionality, union shape, return type, import path.
     Reading this from `packages/**/src` (or the types) is cheap, deterministic, and self-verifying —
     **just look it up when you need the shape.** You do not need the knowledge base for interface,
     and you do not escalate for it; the type system is its always-current store.
   - **Behavior** — anything you'd only learn by reading a function body or tracing control flow: what
     happens on denied consent, when a render forces dynamic, batching/chunking, fallback contracts,
     identifier ownership (SDK-owned vs. reader-invented), defaults and their rationale, cross-SDK
     semantics. **Never re-trace behavior from source** — compose it from the knowledge base
     (`documentation/internal/sdk-knowledge/`), which holds behavioral facts already traced and
     verified, each with a pointer. Re-tracing is the expensive, error-prone work the base exists to
     memoize.

   So: read interfaces directly; compose behavior from the base. Use the matching reference
   implementation under `implementations/` for real-shaped patterns and "adapt" starting points. **If
   the base is missing a fact you need, escalate ONLY when it is behavioral** — an interface gap you
   just look up. Escalate with an inline `<!-- ESCALATE(sdk-knowledge-author): the behavioral fact you
need -->` marker at the point of use; the `sdk-knowledge-authoring` role traces source and records
   the behavior, then you compose the claim from it and remove the marker. No `ESCALATE` marker may
   survive to a finished guide — `pnpm knowledge:check` fails on one. (When you author a guide for an
   SDK whose KB file does not exist yet, that whole file is bootstrapped by `sdk-knowledge-authoring`
   first — see the workflow command.)

   The line matters: if you catch yourself wanting to check what a prop _does_, that is behavior —
   go to the base or escalate; do not quietly re-trace it under cover of an interface lookup.

6. **Sync the TOC and anchors**, add `## Production checks` and (if there are known failure modes)
   `## Troubleshooting`, and link the reference implementation READMEs.
7. **Self-review** against [references/authoring-checklist.md](references/authoring-checklist.md).
8. **Validate**: run `pnpm exec prettier --write <file>`, `pnpm guides:check`, and
   `pnpm knowledge:check`; confirm the collapsible TOC anchors resolve.
9. **Review new or substantially rewritten guides independently.** A newcomer reviewer checks that
   the target reader can perform and verify the guide. A technical-foundation reviewer checks
   interfaces against `packages/**/src` and behavior against the knowledge base. Resolve blocker and
   high-severity findings before acceptance; the writer does not sign off its own draft.

Normal maintenance builds on the existing guide: preserve correct, useful detail and change only
what the recipe, blueprint, facts, or reader experience require. A clean-room draft is an occasional
stress test for whether the inputs stand on their own, not the default way to refresh documentation.

## Self-review

Before finishing, run the full checklist in
[references/authoring-checklist.md](references/authoring-checklist.md). It is written as mechanical,
checkable assertions so it can also back a future validation hook on `documentation/guides/**`.

## Turning a guide into agent instructions

A goal of this work is converting a nailed guide into instructions an agent can execute to
personalize an app. Author with that in mind: every `**Adapt this to your use case:**` step should
name what to identify in the reader's codebase and what to do with it, so the step translates
directly into an agent instruction later.
