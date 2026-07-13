# AGENTS.md

Applies to public guides under `documentation/guides/`.

When you create, rewrite, or review any guide here — integration guides (`integrating-*.md`),
`choosing-the-right-sdk.md`, supplemental recipe guides, or the directory `README.md` routing index
— use two source-of-truth layers:

- **Structure** — the archetype's recipe under [`../authoring/recipes/`](../authoring/recipes/), and
  the reusable shared prose it composes under [`../authoring/fragments/`](../authoring/fragments/).
  The recipe owns the section spine, the fixed heading order, the integration categories, the
  `## Before you start` prerequisites shape, and the example-label set. It is authoritative over any
  sibling guide.
- **Voice and workflow** — the **`optimization-guide-authoring`** skill: the teach-first
  quick-start-then-deepen approach, the copy-vs-adapt honesty principle, the directory README rules,
  and the self-review checklist.

The skill lives at `skills/optimization-guide-authoring/` (a tool-neutral top-level directory,
symlinked into `.claude/skills/` and `.agents/skills/`). Do not duplicate recipe structure or skill
principles back into this file — keep this pointer thin and let those artifacts be the source of
truth.

Deeper mechanics belong in `documentation/concepts/`, exhaustive API detail in generated TypeDoc
under `docs/`, and prose style in the repo `STYLE_GUIDE.md`.
