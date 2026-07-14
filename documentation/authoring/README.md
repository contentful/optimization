# Guide authoring inputs

Internal, unpublished composition inputs for the public guides under [`../guides/`](../guides/).
Technical writers shape how guides teach here without having to understand SDK implementation
details; SDK and knowledge authors maintain verified behavior separately.

These files are read and instantiated by the guide-writer role. They are not a deterministic
templating language, and they are not published as reader documentation.

## Start here

First classify the work by what changed. That choice determines which parts of the pipeline need to
run and prevents an editorial iteration from repeating expensive SDK comprehension.

| You want to…                                       | Workflow               | What it does                                                                                        |
| -------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------- |
| Bootstrap documentation for an SDK with no KB file | **Author a guide**     | Derives behavior into a new KB file, authors the blueprint, composes the guide, and reviews it      |
| Update docs after SDK source changed               | **Refresh docs**       | Re-verifies only affected KB facts, updates consuming guide passages, and reviews the changed scope |
| Tune wording, structure, sequence, or shared copy  | **Iterate on a guide** | Recomposes from the existing KB without reading source or re-verifying facts                        |
| Check an existing or newly written guide           | **Review a guide**     | Runs independent newcomer and technical-foundation reviews, applies fixes, and funnels lessons back |

### Run the workflow in Claude Code

The repository provides four slash commands:

| Command          | Use when                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| `/author-guide`  | The SDK has no knowledge-base file yet. This is the expensive, one-time bootstrap path.            |
| `/refresh-docs`  | SDK source changed. This is the scoped, incremental fact-refresh path.                             |
| `/iterate-guide` | The change is editorial only: prose, tone, sequence, a recipe, shared copy, or an SDK blueprint.   |
| `/review-guide`  | A guide needs the final newcomer and technical-foundation gate, or a factual claim needs checking. |

The command definitions live under [`.claude/commands/`](../../.claude/commands/). They orchestrate
the same skills and roles described below; the commands are convenience entry points, not a separate
authoring system.

### Run the workflow with skills and roles

In Codex or another skill-aware agent, name the workflow and the repository skills explicitly. The
project-scoped Codex roles under [`.codex/agents/`](../../.codex/agents/) provide the same writer,
reviewer, verifier, and knowledge-author responsibilities.

| Workflow            | Skills and roles, in order                                                                                                                                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Author a guide**  | `sdk-knowledge-authoring` in **BOOTSTRAP** mode → author the SDK blueprint → `optimization-guide-authoring` / guide writer → `guide-newcomer-review` + `guide-source-verification` → resolve any fact escalation and validate |
| **Refresh docs**    | `sdk-knowledge-authoring` in **INCREMENTAL** mode → update only affected blueprint/guide passages → `guide-newcomer-review` + `guide-source-verification` on the changed scope → validate                                     |
| **Iterate a guide** | `optimization-guide-authoring` / guide writer using the existing KB, recipe, blueprint, and shared copy → `pnpm guides:check`; run the two review skills before shipping substantial changes                                  |
| **Review a guide**  | `guide-newcomer-review` and `guide-source-verification` independently → guide writer applies findings → `sdk-knowledge-authoring` resolves only genuine behavioral gaps → validate                                            |

The relevant skill instructions are:

- [`optimization-guide-authoring`](../../skills/optimization-guide-authoring/SKILL.md) — teaching
  voice, guide structure rules, and the writer workflow;
- [`guide-newcomer-review`](../../skills/guide-newcomer-review/SKILL.md) — whether the target reader
  can understand, perform, and verify the guide;
- [`guide-source-verification`](../../skills/guide-source-verification/SKILL.md) — interface checks
  against current package source and behavioral checks against the KB;
- [`sdk-knowledge-authoring`](../../skills/sdk-knowledge-authoring/SKILL.md) — bootstrap or
  incremental derivation of verified behavioral knowledge from source;
- [`sdk-knowledge-maintenance`](../../skills/sdk-knowledge-maintenance/SKILL.md) — KB structure,
  source pointers, and ownership rules.

The required authoring order for a new or substantially rewritten guide is **writer → newcomer
reviewer → technical-foundation reviewer**. The writer never certifies its own draft. The two
reviewers are independent and may run concurrently after the draft exists.

### Technical writer inner loop

For wording, tone, teaching order, or structure:

1. Edit the artifact that owns the decision:
   - recipe for a rule that should affect every guide of an archetype;
   - blueprint for how one SDK should be taught;
   - shared copy for wording that must stay consistent across several guides;
   - the guide itself for reader-facing detail that is neither shared nor structural.
2. Run `/iterate-guide` or ask the guide-writer role to recompose the affected guide from the current
   recipe, blueprint, shared copy, and KB.
3. Read the resulting guide as a reader and repeat the editorial loop as needed.
4. Run `pnpm guides:check` during iteration.
5. Before shipping a new or substantial rewrite, run `/review-guide` or the newcomer and
   technical-foundation review skills, resolve blocker/high findings, then run both validators.

Do not use the editorial loop to change what a guide asserts about the SDK. If SDK source changed,
use the refresh workflow. If a claim merely looks suspicious, use the review workflow. If review
finds a behavioral fact missing from the KB, hand that specific gap to `sdk-knowledge-authoring`;
do not make the technical writer trace implementation behavior.

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

The `optimization-guide-authoring` skill owns teaching voice and workflow. It does not duplicate
the recipe's archetype structure, the blueprint's per-SDK editorial decisions, or the KB's facts.

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

## Composition order

1. Pick the guide archetype and open its recipe.
2. Open the SDK blueprint. Its Section map is the guide's exact `###` inventory and says what each
   section must teach or show.
3. Read behavioral facts from the linked KB sections. Read exact interface shapes directly from
   package types. Use the maintained reference implementation for realistic application shape.
4. Reuse the shared copy selected by the recipe and blueprint.
5. Write or update the guide. Do not inspect sibling guides to infer structure.
6. Run `pnpm guides:check`; before shipping a new or substantial rewrite, run the newcomer and
   technical-foundation reviews.

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
