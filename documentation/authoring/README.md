# Guide authoring inputs

Internal composition inputs for the public guides under [`../guides/`](../guides/). Technical writers
shape how guides teach here without having to understand SDK implementation details; SDK and
knowledge authors maintain verified behavior separately.

## The contract

| Layer                                             | Owns                                                                                        | Must not own                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Recipe** (`recipes/`)                           | Archetype-wide section spine, allowed categories, and output rules                          | Per-SDK section choices or SDK facts                     |
| **Blueprint** (`blueprints/`)                     | One SDK's reader goal, quick-start proof, milestones, section plan, and teaching priorities | SDK behavior, detailed API shape, or reader-facing prose |
| **Shared copy** (`fragments/`)                    | Reader-facing wording that must stay consistent across several guides                       | Hidden per-SDK decisions or SDK behavior                 |
| **Knowledge base** (`../internal/sdk-knowledge/`) | Verified behavioral facts and provenance                                                    | Editorial sequence or guide prose                        |
| **Types/source** (`../../packages/`)              | Exact interface shape: exports, signatures, props, and returns                              | Editorial decisions                                      |
| **Guide** (`../guides/`)                          | Published explanation, examples, and task flow                                              | New unsupported facts                                    |

The guide writer composes these layers; it is not itself a source of truth.

Use this ownership test:

- A fact about what the SDK does belongs in the knowledge base.
- A rule that should change every guide of an archetype belongs in the recipe.
- A decision about how one SDK should be taught belongs in its blueprint.
- A sentence that must be identical across several guides belongs in shared copy.
- Everything else is reader-facing guide prose.

## What reproducible means

The pipeline aims to reproduce the same **reader outcome**, not identical prose. Independent writers
should converge on:

- the quick-start result and verification;
- the section inventory, order, and categories;
- the required explanations, examples, warnings, and decision aids in each section;
- the SDK facts covered, with no unsupported behavioral claims;
- a guide that passes newcomer and technical-foundation review.

Word-for-word similarity is not a success criterion. A blueprint that grows until it shadows the
guide defeats the separation and creates a stale second fact store.

Most documentation work is iterative: start from the existing guide, preserve useful detail, and
change only what the reader goal, editorial brief, or verified facts require. A clean-room draft is
an occasional stress test for whether these inputs can stand on their own. It is not the default
refresh workflow. A genuinely new guide has no inherited detail, so plan extra writing and review
iterations instead of making every blueprint encode a finished document in advance.

## How to work

1. Pick the guide archetype and open its recipe.
2. Open the SDK blueprint. Its Section map is the guide's exact `###` inventory and says what each
   section must teach or show.
3. Read behavioral facts from the linked KB sections. Read exact interface shapes directly from
   package types. Use the maintained reference implementation for realistic application shape.
4. Reuse the shared copy selected by the recipe and blueprint.
5. Write or update the guide. Do not inspect sibling guides to infer structure.
6. Run `pnpm guides:check`, the newcomer review, and the technical-foundation review.

For a source change, update the KB first and then only the blueprint/guide sections that consume the
changed facts. For a purely editorial change, update the recipe, blueprint, or shared-copy file that owns the
decision and recompose the affected guide.

## Blueprint design

Every blueprint copies [`blueprints/_template.md`](./blueprints/_template.md). Treat it as the
technical writer's brief for one guide. It uses structured Markdown so people can scan and edit it,
while agents and deterministic validation can consume the same decisions.

The Section map records:

- exact section title and category;
- the reader purpose—the editorial reasoning worth preserving;
- what the guide must teach or show, such as a runnable example, decision table, ownership warning,
  or failure mode;
- links to KB sections that supply the behavior.

A technical writer can own the outcome, verification, section order, Purpose, and “Must teach or
show” cells without tracing implementation code. An SDK or knowledge author maintains the Fact
sources links and fills behavioral gaps. That separation is the point of the brief: editorial input
should not require SDK expertise.

API names may identify a section or required example. Defaults, detailed signatures, fallback causes,
and behavioral explanations stay in the KB or guide. Link roles use exact validated local links so an
isolated writer does not have to inspect sibling guides or guess filenames.

## Shared copy

Shared copy is worthwhile only when exact wording improves the reader experience across guides. Keep
it small. Any inclusion or variation choice must be explicit in the recipe or blueprint; never hide
SDK-family logic inside shared copy.

The integration recipe currently composes:

- `personalization-explainer.md`—fixed conceptual wording plus two explicit blueprint switches;
- `authored-variant-gotcha.md`—one invariant prerequisite warning with no SDK-specific slots.

## Validation and coverage

`pnpm guides:check` validates blueprint shape, local blueprint and guide links, and
blueprint-to-guide section and category agreement. `pnpm knowledge:check` validates KB pointer
integrity and unresolved escalations. Neither command proves behavioral truth; semantic freshness
comes from the scoped knowledge-author and technical-foundation reviews.

Blueprints and KB files currently cover the six JS/TS integration guides: Node, Web, React Web,
Next.js App Router, Next.js Pages Router, and React Native. Native Swift/Kotlin guides, the decision
guide, and supplemental guides remain outside the regeneration guarantee until their KB and planning
edges are bootstrapped.

## Files

```text
recipes/
  integration.md
  decision.md
  supplemental-recipe.md
blueprints/
  _template.md
  node.md
  web.md
  react-web.md
  nextjs-app-router.md
  nextjs-pages-router.md
  react-native.md
fragments/
  personalization-explainer.md
  authored-variant-gotcha.md
```
