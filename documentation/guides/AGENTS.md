# AGENTS.md

Applies to public guides under `documentation/guides/`.

When you create, rewrite, or review any guide here — integration guides (`integrating-*.md`),
`choosing-the-right-sdk.md`, supplemental recipe guides, or the directory `README.md` routing index
— use the **`optimization-guide-authoring`** skill. It owns the archetypes, the teach-first
quick-start-then-deepen structure, the copy-vs-adapt example labels, the `## Before you start`
prerequisites block, the directory README rules, and the self-review checklist.

The skill lives at `.claude/skills/optimization-guide-authoring/`; its `references/` hold the
per-archetype templates and the checklist. Do not duplicate those rules back into this file — keep
this pointer thin and let the skill be the source of truth.

Deeper mechanics belong in `documentation/concepts/`, exhaustive API detail in generated TypeDoc
under `docs/`, and prose style in the repo `STYLE_GUIDE.md`.
