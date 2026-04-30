# AGENTS.md

Read the repository root `AGENTS.md` first.

These instructions apply to authored documentation under `documentation/`.

## Documentation Categories

- Put step-by-step implementation material in `guides/`.
- Put "how it works" explanations in `concepts/`.
- Put nonconforming or unpublished material in `drafts/`. Drafts are not part of public navigation
  unless the user explicitly asks to publish or link them.
- When package README content grows beyond orientation and common setup, first look for an existing
  guide or concept that matches the reader goal and update that document instead of creating a new
  one. Create a new guide only when the material has no existing guide home.
- Do not move exhaustive API reference material from READMEs into authored docs when generated
  TypeDoc already owns the detail. Authored docs should explain integration flow, decisions, and
  mechanics that generated reference docs cannot.

## Directory README Files

- Keep directory `README.md` frontmatter `children` aligned with the visible list order in the same
  file.
- When adding, moving, or removing a document, update the nearest directory `README.md` and any
  affected relative links in the same change.
- Treat directory README files as navigation indexes, not full guides or concepts. Keep the body to
  a short "start here" paragraph and grouped lists of child documents with one-sentence
  descriptions.
- Use the observed index headings for consistency: `## Sections` at the documentation root,
  `## Start Here` and `## Integration Guides` under `guides/`, and `## Available Concepts` under
  `concepts/`.
- Preserve frontmatter `title` values that match the visible `#` heading.

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
- For moved or newly linked documents, verify relative Markdown links resolve to existing files when
  the target is inside the repository.
