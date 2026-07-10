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

**Structure lives in recipes, not here.** A guide's section spine, fixed heading order, integration
categories, example-label rules, and the reusable shared prose (fragments) live in
[`documentation/authoring/`](../../documentation/authoring/) — one recipe per archetype plus the
fragments they compose. This skill holds the transferable principles (below); the recipe holds the
shape of a given archetype. When you write or refresh a guide, open the matching recipe as the
structural source of truth and this skill for the voice and workflow. Do not restate recipe structure
here, and do not let SDK facts (which belong in the knowledge base) leak into either.

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
- **No SDK-version guidance while the SDK is pre-release/alpha.** With one moving version, do not
  distinguish SDK versions, tell readers to "upgrade to the fixed version", or document
  version-to-version deltas of _this SDK_ — there is no stable version surface to reason about yet.
  Document the single current version in present tense. Revisit at the first major release, when
  version differences become real to a reader. This applies only to _this SDK's_ versions;
  host-framework version guidance (e.g. a Next.js 15 vs 16 filename/export the reader must choose
  between today) is a present-state fact about the reader's environment and stays.

## Scope

- Guides under `documentation/guides/`: `integrating-*.md`, `choosing-the-right-sdk.md`,
  supplemental recipe guides, and the directory `README.md` routing index.
- This skill owns teaching voice, the copy-vs-adapt honesty principle, and the authoring workflow.
  Section structure, heading order, integration categories, and the reusable shared prose belong to
  the recipes and fragments under [`documentation/authoring/`](../../documentation/authoring/).

## Not in scope

- **Guide structure** — the section spine, fixed heading order, integration categories, TOC rules,
  and per-archetype skeletons live in the recipes under `documentation/authoring/recipes/`. Reusable
  reader-facing prose (the personalization explainer, the authored-variant gotcha) lives in
  `documentation/authoring/fragments/`. Open the matching recipe as the structural source of truth.
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

The recipe owns the fixed section order, the `**Integration category:**` line values, the
`## Before you start` prerequisites shape, the example-label set, and which fragments each archetype
composes (the personalization explainer, the authored-variant gotcha). Do not re-derive structure
from a sibling guide — the recipe is authoritative; sibling guides are examples of it.

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

1. **Identify the archetype and reader goal.** Open the matching recipe under
   `documentation/authoring/recipes/`. Its `## Template` is the section spine; its `## Context` is the
   structural rationale. The fragments it references are the shared prose you will instantiate.
2. **Draft the intro and quick start first.** The intro's teaching content is the
   `personalization-explainer` fragment — instantiate it (copy its Template verbatim, fill each
   `⟨slot⟩` from the knowledge base) rather than hand-writing an explainer. Quick start = one proof,
   one verification statement, minimum setup. Keep optional concerns (analytics, preview, live
   updates, identity, strict consent, caching) out of it unless that concern is the chosen proof.
3. **Write `## Before you start`** as an outside-the-guide prerequisites list, including the
   `authored-variant-gotcha` fragment (mandatory) so the reader can tell personalization from a bug.
4. **Fill feature sections in order**, each with its integration-category line and numbered
   procedure. Cover the shared concern checklist or mark concerns not-applicable (see
   [references/authoring-checklist.md](references/authoring-checklist.md)).
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
8. **Validate formatting**: `pnpm format:fix <file>` (or `format:check`), and confirm the
   collapsible TOC anchors resolve to real headings.

## Self-review

Before finishing, run the full checklist in
[references/authoring-checklist.md](references/authoring-checklist.md). It is written as mechanical,
checkable assertions so it can also back a future validation hook on `documentation/guides/**`.

## Turning a guide into agent instructions

A goal of this work is converting a nailed guide into instructions an agent can execute to
personalize an app. Author with that in mind: every `**Adapt this to your use case:**` step should
name what to identify in the reader's codebase and what to do with it, so the step translates
directly into an agent instruction later.
