# Guide authoring: recipes and fragments

Writer-owned composition inputs for the public guides under [`../guides/`](../guides/). **Not
published** — these are the source the `guide-writer` agent composes _from_, the reader-facing mirror
of the internal [`../internal/sdk-knowledge/`](../internal/sdk-knowledge/) knowledge base.

A technical writer shapes guide structure, sequence, and shared wording here — for a whole class of
guides, never one guide surgically, and never by editing agent logic. The composition is done by an
LLM (`guide-writer`), not a deterministic templating engine: recipes and fragments are prose it reads
and instantiates, not code it executes.

## Start here (technical writers)

This directory is your front door. To change how the guides read:

1. **Edit the structure or wording** — a **recipe** (`recipes/`) for a guide archetype's section
   spine and sequence (SDK-neutral), a **blueprint** (`blueprints/`) for one SDK's section inventory,
   order, and categories, or a **fragment** (`fragments/`) for a shared paragraph reused across
   guides. You never touch SDK facts (those live in the knowledge base) or agent logic. Reorder a
   guide's sections or recategorize one → its blueprint. Change how a whole archetype is shaped → its
   recipe.
2. **Re-render fast** — run **`/iterate-guide`**; it recomposes the affected guides from the existing
   knowledge base without reading source or re-verifying facts. This is the tight inner loop for
   phrasing, tone, and sequence. A change that would alter what a guide _asserts_ about the SDK (a
   prop, a behavior, a return shape) is out of scope and hands off to `/refresh-docs` or
   `/review-guide`.
3. **Gate before shipping** — run **`/review-guide`**; it runs the newcomer and technical-foundation
   review roles and funnels durable lessons back into recipes, fragments, or the knowledge base.

For the SDK-fact side of the pipeline (`/author-guide`, `/refresh-docs`, `pnpm knowledge:check`), see
[`../internal/sdk-knowledge/README.md`](../internal/sdk-knowledge/README.md) and the "Guides and the
knowledge base" section of the repository [`CONTRIBUTING.md`](../../CONTRIBUTING.md).

## The layers

| Layer                                         | Holds                                                                             | Owner                  |
| --------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------- |
| **Recipe** (`recipes/`)                       | an archetype's editorial spine + which fragments it composes (SDK-neutral)        | technical writer       |
| **Fragment** (`fragments/`)                   | reusable reader-facing prose, fixed spine + KB-filled slots                       | technical writer       |
| **Blueprint** (`blueprints/`)                 | one SDK's editorial map: which facts → which section → order → category, with why | technical writer       |
| Knowledge base (`../internal/sdk-knowledge/`) | the values a fragment's slots resolve to (SDK behavior facts)                     | SDK / knowledge author |
| `guide-writer` agent                          | renders the recipe + blueprint + fragments into a guide                           | the pipeline           |

**Recipe vs. blueprint** — the recipe is the shape _every_ guide of an archetype shares (SDK-neutral:
the `##` spine, heading order, the integration-category value set, the craft rules). The blueprint is
how _one_ SDK's facts fill that shape (per-SDK judgment: which features become which `###` sections,
in what order, under which category, what proves the quick start, where the milestone boundary falls —
with the reasoning). The recipe answers "what does an integration guide look like?"; the blueprint
answers "for Node specifically, how do its facts arrange into that?" A reproduction test showed that
without the blueprint the section inventory and categories are re-invented on every compose and drift
from the shipped guide — the blueprint memoizes that editorial judgment the way the knowledge base
memoizes comprehension. It holds no SDK facts (those stay in the KB) and no archetype structure (that
stays in the recipe).

The `optimization-guide-authoring` skill keeps **voice and workflow** (how to write well, the
authoring loop). Structure lives here, in the recipes — one source of truth, not scattered across the
skill and sibling guides.

## Every recipe and fragment file has two sections

- **`## Context`** — addressed to the `guide-writer` agent. Rationale, how to fill each slot, when to
  include or skip a fragment, which KB fact backs which slot. **Never rendered into a guide.**
- **`## Template`** — the prose that becomes guide output. For a fragment this is near-verbatim reader
  prose with `⟨slot⟩` markers; for a recipe it is the section spine plus fragment references and
  local instructions.

The frontmatter carries only machine identity (`archetype:` / `fragment:`).

A **blueprint** is entirely agent-facing — the whole file is guidance for the `guide-writer`, never
rendered into the guide. It is **prose, not a data format**: the consumer is the LLM, whose native
interface is natural language (the same reason a YAML-token recipe format was rejected when this layer
was built), so the value is the _reasoning_ — why a section is Required, why the milestone splits
where it does — not a `section | category` table. Every blueprint copies
[`blueprints/_template.md`](./blueprints/_template.md), which defines the role, the recipe/blueprint/KB
split, and the fixed headings **once** — a per-SDK file carries only its own editorial map, never a
restatement of what a blueprint is. Fill it in for one SDK; do not re-explain the artifact.

## How composition works

- A recipe is the **caller**: it names each fragment it composes (as a markdown link) at the section
  where it belongs, and may add a local instruction on that line ("include X, but drop the Y clause
  here"). Fragments never name their callers — the recipe owns inclusion.
- The `guide-writer` copies an instantiated fragment's Template **verbatim** and fills only its
  `⟨slots⟩` from the knowledge base. The verbatim spine is what keeps a guide family consistent, so
  the agent does not reword it.
- Per-SDK variation lives in a fragment's **slots**, filled from the KB at compose time — not in the
  recipe. The recipe only expresses per-archetype shape. This keeps the writer editing classes, not
  individual guides.
- Per-SDK **structure** — the specific section inventory, order, and categories — lives in that SDK's
  **blueprint**, read alongside the recipe. The recipe gives the `##` spine and the category value
  set; the blueprint fills the `###` inventory for this SDK. The `guide-writer` takes the section map
  from the blueprint rather than inventing it or copying a sibling guide.

## Coverage

Blueprints (and KB files) currently exist for the six JS/TS integration guides: `node`, `web`,
`react-web`, `nextjs-app-router`, `nextjs-pages-router`, `react-native`. **Not yet covered:** the four
native guides (iOS SwiftUI/UIKit, Android Compose/Views) have no KB file, no blueprint, and no
`feeds-guides` edge, so `/refresh-docs` and `/iterate-guide` cannot see them — their structure and
facts live only inside the guide prose. Native source is Swift/Kotlin (`packages/ios`,
`packages/android`) with no `package.json`, so the knowledge-base validator cannot discover it as an
SDK key or resolve `#symbol` pointers; bootstrapping native docs needs a different symbol-resolution
strategy and is a separate effort. The decision guide (`choosing-the-right-sdk.md`) and the two
supplemental guides also have no KB `feeds-guides` edge yet. Treat all of these as outside the
refresh/iterate guarantee until they are bootstrapped.

## Files

```
recipes/                  # SDK-neutral archetype shapes
  integration.md          # integrating-*.md
  decision.md             # choosing-the-right-sdk.md and future decision guides
  supplemental-recipe.md  # analytics forwarding and similar
blueprints/               # per-SDK editorial maps (integration archetype)
  _template.md            # canonical skeleton + the recipe/blueprint/KB split, stated once
  node.md                 # → integrating-the-node-sdk-in-a-node-app.md
  web.md, react-web.md, nextjs-app-router.md, nextjs-pages-router.md, react-native.md
fragments/
  personalization-explainer.md  # intro explainer (integration guides)
  authored-variant-gotcha.md    # the mandatory Before-you-start bullet
```

Machine enforcement of recipe/fragment usage (a `guides:check` validator) is **deferred**: for now
the `guide-writer` and the newcomer/source reviewers enforce it by following these files. Because
fragment spines are reproduced verbatim, a future check can confirm instantiation by matching the
fixed sentences.

## Iterating

To tune wording, tone, or sequence and re-render the guides fast, edit a recipe or fragment here and
run **`/iterate-guide`** — it recomposes the affected guides from the existing knowledge base without
reading source or re-verifying facts. It is editorial-only: a change that would alter what a guide
_asserts_ about the SDK (a prop, a behavior, a return shape) hands off to `/refresh-docs` or
`/review-guide`. Run `/review-guide` as the final pass before shipping.
