# AGENTS.md

Applies to authored documentation under `documentation/`.

## Structure

- Follow [`../STYLE_GUIDE.md`](../STYLE_GUIDE.md) plus root Markdown rules.
- Put step-by-step implementation material in `guides/`, mechanics explanations in `concepts/`, and
  unpublished or nonconforming material in `drafts/`.
- When README content grows beyond orientation and common setup, update an existing guide or concept
  before creating a new document.
- Generated TypeDoc owns exhaustive API reference; authored docs explain integration flow,
  decisions, and mechanics.

## Directory READMEs

- Treat directory `README.md` files as navigation indexes.
- Keep frontmatter `children`, visible list order, and one-sentence child descriptions aligned.
- When adding, moving, or removing docs, update the nearest directory README and affected links.
- Preserve observed index headings and frontmatter `title` values matching the visible `#` heading.

## Writing and links

- Write for engineers integrating the SDK into consumer applications.
- Lead with the reader goal, keep default paths before advanced variants, and explain consequences
  behind constraints.
- Separate SDK responsibilities from application responsibilities, especially fetching, consent
  policy, identity policy, routing, and rendering.
- Link from guides to concepts for deeper mechanics.
- Guides and concepts may link to docs, package READMEs, implementation READMEs, and generated
  reference docs, but not directly to source code, tests, generated outputs, or source line numbers.

## Validate

- Run Prettier on touched Markdown files and `git diff --check`.
- For moved or newly linked documents, verify repository-local relative links resolve.
