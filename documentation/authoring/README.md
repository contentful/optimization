# Guide authoring inputs

Internal, unpublished composition inputs for the public guides under [`../guides/`](../guides/).
Technical writers shape how guides teach here without having to understand SDK implementation
details; SDK and knowledge authors maintain verified behavior separately.

These files are read and instantiated by the guide-writer role. They are not a deterministic
templating language, and they are not published as reader documentation.

## Start here

First classify the work by what changed. That choice determines which parts of the pipeline need to
run and prevents an editorial iteration from repeating expensive SDK comprehension.

- **Author a guide** when an SDK has no knowledge-base file yet.
- **Refresh docs** when SDK source changed.
- **Iterate on a guide** for wording, structure, sequence, or shared-copy changes.
- **Review a guide** to check an existing or newly written guide before shipping it.
- **Author a migration guide** when an existing integration is moving from a legacy SDK to the
  Optimization SDK Suite.

### Run the workflows

Name the workflow and repository skills explicitly. Any skill-aware agent can run the process; no
workflow depends on a particular agent product or command syntax.

#### Author a guide

Use this workflow when the SDK has no knowledge-base file yet.

1. Run `sdk-knowledge-authoring` in **BOOTSTRAP** mode to derive and verify the SDK's behavioral
   knowledge.
2. Create the SDK blueprint from the recipe and new KB file.
3. Draft the guide with `optimization-guide-authoring` and the guide-writer role.
4. Run `guide-newcomer-review` and `guide-source-verification` independently.
5. Resolve review findings and any genuine behavioral gap, then validate the KB and guide.

#### Refresh docs

Use this workflow when SDK source changed.

1. Scope the changed source files and the KB facts that point to them.
2. Run `sdk-knowledge-authoring` in **INCREMENTAL** mode for those facts only.
3. Update only the guide passages that consume changed facts. Update the blueprint only when the
   change adds, removes, or materially changes a teaching obligation.
4. Run both review skills on the changed passages, then validate the KB and guide.

#### Iterate on a guide

Use this workflow for editorial changes that do not alter an SDK claim.

1. Keep the existing KB as-is; do not read source or re-verify behavior.
2. Use `optimization-guide-authoring` and the guide-writer role to recompose from the recipe,
   blueprint, shared copy, and accepted guide.
3. Run `pnpm guides:check` while iterating.
4. Run both review skills before shipping a new or substantially rewritten guide.

#### Review a guide

Use this workflow as the final quality gate or when an existing claim looks suspicious.

1. Run `guide-newcomer-review` and `guide-source-verification` independently.
2. Have the guide writer apply the reader and technical findings.
3. Use `sdk-knowledge-authoring` only when verification exposes a genuine behavioral gap in the KB.
4. Run `pnpm knowledge:check` and `pnpm guides:check` after resolving the findings.

#### Author a migration guide

Use this workflow when a guide moves an existing integration from a legacy SDK to the Optimization
SDK Suite.

1. Read the migration recipe, the matching migration blueprint, and the migration knowledge file.
2. Read the target SDK blueprint and KB sections linked by the migration blueprint.
3. Draft the guide with `optimization-guide-authoring` and the guide-writer role. Keep runtime
   migrations split; use the plugin/privacy/preview and content-model migration guides for shared
   replacement work.
4. Hand missing legacy facts to the migration-knowledge author and missing target behavior facts to
   `sdk-knowledge-authoring`; do not invent either in the guide.
5. Run the newcomer and technical-foundation reviews before shipping.

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

### Tool integration

The skills are shared. [`skills/`](../../skills/) is the source of truth;
[`.agents/skills`](../../.agents/skills) and [`.claude/skills`](../../.claude/skills) both point to it
for tool discovery. Both Claude Code and Codex invoke these same skills directly.

The repository also provides optional adapters around that shared layer:

- matching specialized roles under [`.claude/agents/`](../../.claude/agents/) and
  [`.codex/agents/`](../../.codex/agents/); each role applies one or more of the shared skills;
- `/author-guide`, `/refresh-docs`, `/iterate-guide`, and `/review-guide` shortcuts under
  [`.claude/commands/`](../../.claude/commands/) for orchestrating the complete workflow in Claude
  Code.

These adapters do not own authoring rules. Other skill-aware agents should invoke the same skills in
the same order and preserve the same role boundaries.

### Technical writer inner loop

For wording, tone, teaching order, or structure:

1. Edit the artifact that owns the decision:
   - recipe for a rule that should affect every guide of an archetype;
   - blueprint for how one SDK should be taught;
   - shared copy for wording that must stay consistent across several guides;
   - the guide itself for reader-facing detail that is neither shared nor structural.
2. Run the **Iterate a guide** workflow: ask the guide-writer role to recompose the affected guide
   from the current recipe, blueprint, shared copy, and KB. In Claude Code, `/iterate-guide` is a
   convenience wrapper for this workflow.
3. Read the resulting guide as a reader and repeat the editorial loop as needed.
4. Run `pnpm guides:check` during iteration.
5. Before shipping a new or substantial rewrite, run the **Review a guide** workflow with the
   newcomer and technical-foundation review skills, resolve blocker/high findings, then run both
   validators. In Claude Code, `/review-guide` is a convenience wrapper for this workflow.

Do not use the editorial loop to change what a guide asserts about the SDK. If SDK source changed,
use the refresh workflow. If a claim merely looks suspicious, use the review workflow. If review
finds a behavioral fact missing from the KB, hand that specific gap to `sdk-knowledge-authoring`;
do not make the technical writer trace implementation behavior.

## The contract

| Layer                                             | Owns                                                                                        | Must not own                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Recipe** (`recipes/`)                           | Archetype-wide section spine, allowed categories, and output rules                          | Per-SDK section choices or SDK facts                     |
| **Blueprint** (`blueprints/`)                     | One SDK's reader goal, quick-start proof, milestones, section plan, and teaching priorities | SDK behavior, detailed API shape, or reader-facing prose |
| **Migration blueprint** (`migration-blueprints/`) | One legacy-to-target guide's route, guide order, section plan, and fact links               | Legacy facts, SDK behavior, detailed API shape, or prose |
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

Migration blueprints live in `migration-blueprints/` instead of `blueprints/` because the current
`guides:check` contract treats every file in `blueprints/` as a rendered integration guide blueprint.
Until migration guides are added to that validator, validate migration authoring inputs with
Prettier, link review, and the migration-blueprint structural review below.

### Migration-blueprint structural review

Apply this review to every migration blueprint before handing it to a guide writer. It is the
dedicated migration-blueprint check until `guides:check` covers migration guides.

- Frontmatter has `migration`, `archetype: migration`, `source`, and `guide`; the `guide` link and
  Reader goal guide file name agree.
- Reader goal names the legacy state, target result, guide file, and guide order dependency.
- Migration route covers each legacy surface the guide promises to replace and assigns a target route
  plus a detail owner; unsupported or manual replacements route to migration knowledge, not guessed
  guide prose.
- Section plan rows match the intended `###` sections. Each row has a reader purpose, and the Must
  route to column names the target guide, supplemental guide, concept, or decision the writer should
  use.
- Fact sources are links only; legacy behavior points to migration knowledge, target behavior points
  to SDK KB or shared concepts, and interface details are left for source/types lookup while writing.
- Cross-guide prerequisites are explicit: content-model migration before runtime rendering when
  legacy mapper output is involved; plugin/privacy/preview migration after the app has a target
  runtime.
- Validation obligations include a first performable authored variant or baseline check, accepted and
  blocked event observability when events/consent are touched, first-page-event ownership when server
  and browser can both report it, and cache/dynamic consequences for request-bound personalization.
- Ownership boundaries are explicit for app-owned config, consent records, vendor forwarding, manual
  Node/Web hybrid cookies, and SDK-owned target profile cookies.
- Handoffs list only missing legacy or target behavior facts; no `None.` if a section relies on an
  unlinked behavior claim.

Blueprints and KB files currently cover the six JS/TS integration guides — Node, Web, React Web,
Next.js App Router, Next.js Pages Router, and React Native — plus the two native iOS guides (SwiftUI
and UIKit) and the two native Android guides (Jetpack Compose and XML Views). Each native family
shares one KB file (`native/ios.md`, `native/android.md`) with one per-UI blueprint each. Because the
native packages are a Swift Package and a Kotlin/Gradle library rather than TypeScript ones,
`knowledge:check` cannot resolve Swift or Kotlin `#symbol` pointers; native facts use `extern:`
pointers naming the exact file and symbol, while behavior that executes in the shared JS bridge
(`optimization-js-bridge`) or core uses resolvable keys. The decision guide and supplemental guides
remain outside the regeneration guarantee until their KB and planning edges are bootstrapped.

## Files

```text
recipes/
  integration.md
  decision.md
  supplemental-recipe.md
  migration.md
blueprints/
  _template.md
  node.md
  web.md
  react-web.md
  nextjs-app-router.md
  nextjs-pages-router.md
  react-native.md
  ios-swiftui.md
  ios-uikit.md
  android-compose.md
  android-views.md
fragments/
  personalization-explainer.md
  authored-variant-gotcha.md
migration-blueprints/
  _template.md
  experience-js-web.md
  experience-js-react-web.md
  experience-js-nextjs-router-choice.md
  experience-js-nextjs-app-router.md
  experience-js-nextjs-pages-router.md
  experience-js-node-ssr-esr.md
  experience-js-plugins-preview-privacy.md
  experience-js-contentful-model.md
```
