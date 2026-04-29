# AGENTS.md

These instructions apply to authored documentation under `documentation/`.

## Documentation Categories

- Put step-by-step implementation material in `guides/`.
- Put "how it works" explanations in `concepts/`.
- Put nonconforming or unpublished material in `drafts/`. Drafts are not part of public navigation
  unless the user explicitly asks to publish or link them.
- Do not turn an implementation guide into a deep mechanics reference. Link to a concept document
  when the reader needs lower-level behavior details.

## Directory README Files

- Keep directory `README.md` frontmatter `children` aligned with the visible list order in the same
  file.
- In `guides/README.md`, keep `Choosing the Right SDK` under `## Start Here`.
- In `guides/README.md`, list implementation guides under `## Integration Guides` in platform/layer
  order:
  1. Node
  2. Web
  3. React Web
  4. React Native
- When adding, moving, or removing a document, update the nearest directory `README.md` and any
  affected relative links in the same change.

## Integration Guide Structure

Use this structure for implementation guides:

1. H1: `# Integrating the Optimization <SDK Name> SDK in a <Runtime> App`
2. A short introduction that starts with the reader's implementation goal, usually
   `Use this guide when...`
3. A collapsible table of contents immediately after the introduction and before the first `##`
   section.
4. `## Scope and Capabilities`
5. `## The Integration Flow`
6. Numbered `##` sections for core implementation steps only.
7. Unnumbered `##` sections for optional or informative material.
8. `## Reference Implementations to Compare Against`

Do not place a table of contents after a section it outlines.

## Table of Contents

Every guide must include this TOC wrapper:

```md
<details>
  <summary>Table of Contents</summary>
<!-- mtoc-start -->

...

<!-- mtoc-end -->
</details>
```

- The TOC block must appear before the first `##` heading.
- Keep TOC entries and anchors synchronized with the headings after any heading edit.
- Include both `##` and relevant `###` headings in the TOC.

## Numbering Rules

- Number only core implementation steps.
- Do not number optional or informational sections such as live updates, preview panels, caching
  notes, hybrid architecture notes, or reference sections.
- If a section is optional, say so in prose near the integration flow instead of making it part of
  the numbered flow.

## Reference Implementation Policy

- Only link to or mention reference implementations that are co-located in this monorepo.
- Do not link to or mention external demo applications.
- Mention relevant monorepo reference implementations briefly near the top of an integration guide,
  usually in `The Integration Flow`.
- Expand reference links in `Reference Implementations to Compare Against`.
- Prefer links to implementation READMEs and relevant source files over vague references.

## Heading and Writing Style

- Use title case for headings, but keep minor words lowercase unless they are the first or last
  word: `a`, `an`, `and`, `for`, `from`, `in`, `on`, `or`, `the`, `to`, `via`, `with`.
- Preserve official product, package, API, component, and hook casing.
- Lead with what the reader is trying to implement.
- Separate SDK responsibilities from application responsibilities.
- State what the SDK does not own when relevant, especially Contentful fetching, consent policy,
  identity policy, routing, and rendering.
- Prefer concrete implementation guidance over marketing language.

## Cross-Linking

- Link from guides to concepts when the reader needs deeper mechanics.
- Link only to source-of-truth files, package READMEs, implementation READMEs, or relevant source
  files.
- After moving a document, fix all affected relative links.

## Validation

- Run Prettier on touched Markdown files.
- Run `git diff --check`.
- For guide edits, verify that each TOC block appears before the first `##` and that TOC anchors
  resolve to headings.
- For moved or newly linked documents, verify relative Markdown links resolve to existing files when
  the target is inside the repository.
