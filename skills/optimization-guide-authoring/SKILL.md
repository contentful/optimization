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
owns the structure, voice, and self-review rules for those guides so they stay consistent and
teachable. It supersedes the former long-form rules in `documentation/guides/AGENTS.md`, which is
now a thin pointer to this skill.

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
- Structure (archetype and headings), teaching voice, example labels, TOC rules, and self-review.

## Not in scope

- Concept docs under `documentation/concepts/` — they own deeper mechanics; guides link to them.
- Package READMEs, implementation READMEs, and product docs.
- Generated TypeDoc under `docs/` — it owns exhaustive, method-by-method API reference.
- Prose style mechanics — follow the repo `STYLE_GUIDE.md`; let Prettier own formatting.

## Archetypes

Every guide has exactly one primary archetype. Pick it by the reader's primary goal, then open the
matching template.

| Reader goal                                                   | Archetype           | Template                                                                                   |
| ------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------ |
| Integrate an SDK into a specific runtime (`integrating-*.md`) | Integration guide   | [references/integration-guide-template.md](references/integration-guide-template.md)       |
| Choose between SDKs, runtimes, or patterns                    | Decision guide      | [references/decision-and-recipe-templates.md](references/decision-and-recipe-templates.md) |
| Supplement an integration without replacing it                | Supplemental recipe | [references/decision-and-recipe-templates.md](references/decision-and-recipe-templates.md) |

## Core structure for integration guides

The reader's journey is two milestones, layered inside the mandated section order:

1. **Milestone 1 — the quick start.** The single shortest runnable path to one observable result
   (personalized first paint, one accepted page event, one entry resolving, etc.). Complete and
   shippable on its own. This is `## Quick start`.
2. **Milestone 2 and beyond — feature sections.** Everything else, introduced by the section that
   needs it: `## Core integration`, then `## Optional integrations`, then
   `## Advanced integrations`.

Section order is fixed: `# H1` → intro (`Use this guide…`) → `## Quick start` → collapsible TOC →
`## Before you start` → `## Core integration` → `## Optional integrations` (if any) →
`## Advanced integrations` (if any) → `## Production checks` → `## Troubleshooting` (if any) →
`## Reference implementations to compare against`. The template has the full skeleton.

Key rules (the template expands each):

- Organize by feature/concept, not one monolithic flow. No `## The integration flow` /
  `## Required steps` section, and no numbered headings at any level. Procedures are numbered lists
  inside the relevant `###` section.
- Each `###` feature section starts with a bold `**Integration category:**` line using exactly one
  of: `Required for first integration`, `Common but policy-dependent`, `Optional`,
  `Advanced or production-only`. Category placement maps to the parent `##` section.
- **`## Before you start` replaces the old required-setup table.** List only what the reader must
  gather from outside the guide (runtime prerequisites, credentials, and — critically — authored
  Contentful data such as a variant attached to an experience). Do not restate the walkthrough as an
  inventory; the sequenced sections own "where to configure." See
  [references/before-you-start.md](references/before-you-start.md) for what belongs here and the
  authored-variant gotcha every SDK guide must call out.

## Example labels: make copy-vs-adapt honest

Every fenced code block gets a bold intent label immediately before it. The label is a promise to
the reader — keep it true.

- `**Copy this:**` — pasteable with only simple value substitution (IDs, tokens, env var names,
  versions, paths, config values). **The values must actually work against what the guide points
  to.** If a snippet references env var names or endpoints, they must match reality (or the guide
  must note the discrepancy). A placeholder alone does not make a snippet adaptive.
- `**Adapt this to your use case:**` — realistic app-shaped code that needs structural changes,
  placement, or business logic. Say explicitly what is the reader's (their fetch, their components)
  and what is the pattern to copy. Where the change means "find X in your code and wrap/change it,"
  say so — a before/after of the reader's likely code is the strongest form (see the template's
  "composed sections" example).
- `**Follow this pattern:**` — illustrative shape, not drop-in runnable.
- `**Reference excerpt:**` — shortened or copied reference-implementation code.

Add short comments only for SDK-specific lines that carry meaning (lifecycle placement, consent,
event sequencing, fallback, duplicate-event prevention). Do not narrate obvious syntax.

## Directory README (routing index)

Keep `documentation/guides/README.md` a lightweight router only. Use concise fields — `Guide`,
`Runtime or app type`, `Package`. No fastest-path columns, setup summaries, tradeoff matrices, or
procedure previews. Put package tradeoffs in `choosing-the-right-sdk.md` and runnable paths in the
integration guides. Keep the listing order: Node, Web, React Web, Next.js App Router, Next.js Pages
Router, React Native, iOS SwiftUI, iOS UIKit, Android Compose, Android Views.

## Workflow

1. **Identify the archetype and reader goal.** Open the matching template.
2. **Draft the intro and quick start first.** Intro defines the essential terms in plain language
   and frames the milestones. Quick start = one proof, one verification statement, minimum setup.
   Keep optional concerns (analytics, preview, live updates, identity, strict consent, caching) out
   of it unless that concern is the chosen proof.
3. **Write `## Before you start`** as an outside-the-guide prerequisites list, including the
   authored data the reader needs to tell personalization from a bug.
4. **Fill feature sections in order**, each with its integration-category line and numbered
   procedure. Cover the shared concern checklist or mark concerns not-applicable (see
   [references/authoring-checklist.md](references/authoring-checklist.md)).
5. **Compose every SDK claim from the knowledge base, not from source.** The internal knowledge base
   (`documentation/internal/sdk-knowledge/`) is the source of truth for what the SDK does — facts
   already verified against `packages/**/src`, each with a resolvable pointer. Every API you use — a
   hook, prop, config key, context field, return shape — must come from a fact there; read the base,
   do not re-grep source. Use the matching reference implementation under `implementations/` for
   real-shaped patterns and "adapt" starting points, but the base, not the impl, is what makes a claim
   true (the impl proves one path works and can hide nuance). **If the base is missing a fact you
   need, do not verify it from source yourself — escalate** with an inline
   `<!-- ESCALATE(sdk-knowledge-author): the fact you need -->` marker at the point of use; the
   `sdk-knowledge-authoring` role reads source and records the fact, then you compose the claim from
   it and remove the marker. That keeps comprehension in one place and means the next guide reuses
   what this one needed. No `ESCALATE` marker may survive to a finished guide — `pnpm knowledge:check`
   fails on one. (When you author a guide for an SDK whose KB file does not exist yet, that whole file
   is bootstrapped by `sdk-knowledge-authoring` first — see the workflow command.)
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
