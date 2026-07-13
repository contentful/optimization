---
sdk: <sdk key — the packages/ directory basename family this documents>
archetype: integration
kb: ../../internal/sdk-knowledge/<family>/<sdk>.md
guide: ../../guides/<the guide this blueprint composes into>.md
---

<!--
Canonical guide-blueprint template. Copy this into blueprints/<sdk>.md, keep the frontmatter keys and
the section headings below (in this order), and fill each section for one SDK. Delete this comment in
the copy — it defines the artifact once, here, so per-SDK files never repeat it. This is PROSE, not a
data format: the consumer is the guide-writer LLM, so the value is the REASONING (why a section is
Required, why the milestone splits where it does), never a bare section|category table.

What a blueprint is:

- A blueprint is the per-SDK EDITORIAL MAP: how one SDK's knowledge-base facts fill the integration
  recipe. It is agent-facing — the guide-writer reads it and never emits it into the guide.
- It OWNS per-SDK editorial judgment — the section inventory and order, each section's integration
  category, the quick-start proof, the milestone split, and the troubleshooting reader-symptoms, each
  with its reasoning — so a from-scratch compose re-derives the same guide instead of re-inventing it.
  Edit a blueprint → ONE guide changes.
- It does NOT own SDK facts — symbols, props, config keys, return shapes, behavior. Those live in the
  knowledge base (frontmatter `kb:`); cite them by name, never restate them. A fact the blueprint
  needs but the KB lacks is a KB gap to escalate, not something to record here.
- It does NOT own archetype structure — the `##` section spine, the heading order, the
  integration-category value set, which fragments to compose, and the example-label rules. Those live
  in the SDK-neutral recipe (recipes/integration.md); edit it → EVERY integration guide changes. The
  blueprint only decides how THIS SDK's topics fill that spine.

The test for where something belongs: "if I change this, how many guides move?" All of them → recipe.
One → blueprint. A fact about the SDK → knowledge base. Read the recipe for the shape and the
blueprint for the arrangement; the two compose into the guide. See [`../README.md`](../README.md) for
the full layer model.
-->

> Editorial map for the <SDK display name> integration guide — how its knowledge-base facts fill the
> integration recipe. Conventions and the recipe/blueprint/KB split: [`_template.md`](./_template.md).

## What proves it works

<The single quick-start proof and why it is the honest minimum for THIS SDK's shape (e.g. stateless
server → accepted page() + profile, not a resolved entry that needs authored content on day one).
Name the app shape to ground it in and the performable verification.>

## Milestones

<The Milestone 1 / Milestone 2 boundary and the reasoning — what is shippable first and why. Note
where this SDK's boundary differs from siblings (authoring-cost vs. opt-in-vs-mandatory vs. render
lifecycle vs. hydration line).>

## Section order & category, and why

<The ordered feature→section list, grouped under Core integration / Optional integrations / Advanced
integrations, each item as `- **<section title>** — <category> — <one-clause reason for its placement
and category>`. The categories are the recipe's four values. Call out where this SDK diverges from its
family and why, so a compose does not "correct" it to match a sibling.>

## Troubleshooting the reader will actually hit

<Real first-run reader-symptoms as `- **<symptom>** → <likely cause>`, tied to fragments where
relevant (the authored-variant gotcha). Not every theoretical failure — the ones a reader hits.>

## Pinned link targets

<The exact sibling-guide and reference-implementation filenames the guide links to. A from-scratch
compose cannot read the sibling guides, so without these it guesses and misspells the paths. Write
guide links guide-relative (./ and ../../implementations/...), matching how the guides link today.>
