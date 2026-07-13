---
sdk: <sdk key>
archetype: integration
kb: ../../internal/sdk-knowledge/<family>/<sdk>.md
guide: ../../guides/<guide>.md
---

# <SDK display name> guide blueprint

<!--
Copy this file to blueprints/<sdk>.md. Keep the frontmatter keys and level-2 headings in this order.

A blueprint is a compact, human-editable brief for one SDK guide. It records decisions that cannot be
recovered from an SDK fact alone: the reader's first proof, milestone boundary, section inventory and
order, category, purpose, and what each section must teach or show. It links those decisions to the
knowledge base rather than restating behavior.

Ownership test:

- A fact about what the SDK does -> knowledge base.
- A rule that changes every guide of this archetype -> recipe.
- A decision about how one SDK is taught -> blueprint.
- Reader-facing explanation and examples -> guide.

The blueprint is structured Markdown so both agents and `pnpm guides:check` can consume it. Reasoning
belongs in the Purpose cells; SDK behavior does not. API names are allowed only when they identify a
section or required example. Detailed signatures, defaults, fallback causes, and code belong in the
types, KB, or guide.
-->

## Quick-start contract

- **Outcome:** <one observable result>
- **Verification:** <one performable check>
- **Reader shape:** <the application shape the sample adapts>
- **Required artifacts:** <the minimum files or snippets the proof needs>
- **Deliberate simplifications:** <policy assumptions that must be replaced before shipping>
- **Explainer switches:** profile point = <include | omit>; managed-fetch clause = <include | omit>
- **Fact sources:** <links to the KB sections that make this proof valid>

## Milestone contract

- **Milestone 1:** <the quick-start result and why it is independently useful>
- **Milestone 2:** <the next layer and why it is deferred>
- **Boundary:** <the editorial distinction between the milestones>
- **Fact sources:** <links to the relevant KB sections>

## Section map

Use the recipe's exact category values. Every row becomes one `###` section in this order. “Must
teach or show” describes the explanation, example, decision table, or warning the reader needs; it
does not state the SDK behavior itself.

| Section | Category | Purpose | Must teach or show | Fact sources |
| ------- | -------- | ------- | ------------------ | ------------ |
| ...     | ...      | ...     | ...                | ...          |

## SDK-specific authoring overrides

Only add an override when the recipe plus section map would otherwise produce a misleading guide.
State placement or teaching treatment, then link the supporting fact. Do not copy the fact here.
Write `None.` when no override is needed.

## Troubleshooting scope

List reader-observable symptoms worth diagnosing. Causes and fixes come from the linked KB sections
at composition time.

| Reader symptom | Why it belongs | Fact sources |
| -------------- | -------------- | ------------ |
| ...            | ...            | ...          |

## Link roles

Record each relationship as a descriptive Markdown link to its exact local target. The writer can
emit the link without opening a sibling guide, and `pnpm guides:check` catches renamed or missing
targets.

- [<sibling guide or supplemental task>](<relative path>)
- [<maintained reference implementation>](<relative path>)
