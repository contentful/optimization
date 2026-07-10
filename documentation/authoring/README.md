# Guide authoring: recipes and fragments

Writer-owned composition inputs for the public guides under [`../guides/`](../guides/). **Not
published** — these are the source the `guide-writer` agent composes _from_, the reader-facing mirror
of the internal [`../internal/sdk-knowledge/`](../internal/sdk-knowledge/) knowledge base.

A technical writer shapes guide structure, sequence, and shared wording here — for a whole class of
guides, never one guide surgically, and never by editing agent logic. The composition is done by an
LLM (`guide-writer`), not a deterministic templating engine: recipes and fragments are prose it reads
and instantiates, not code it executes.

## The layers

| Layer                                         | Holds                                                                       | Owner                  |
| --------------------------------------------- | --------------------------------------------------------------------------- | ---------------------- |
| **Recipe** (`recipes/`)                       | a guide archetype's editorial spine + which fragments it composes, in order | technical writer       |
| **Fragment** (`fragments/`)                   | reusable reader-facing prose, fixed spine + KB-filled slots                 | technical writer       |
| Knowledge base (`../internal/sdk-knowledge/`) | the values a fragment's slots resolve to (SDK behavior facts)               | SDK / knowledge author |
| `guide-writer` agent                          | renders the recipe + fragments into a guide                                 | the pipeline           |

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

## Files

```
recipes/
  integration.md          # integrating-*.md
  decision.md             # choosing-the-right-sdk.md and future decision guides
  supplemental-recipe.md  # analytics forwarding and similar
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
