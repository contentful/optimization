# AGENTS.md

Applies to authored documentation under `documentation/`.

## Structure

- Follow [`../STYLE_GUIDE.md`](../STYLE_GUIDE.md) plus root Markdown rules.
- Put step-by-step SDK integration material in `guides/`, mechanics explanations in `concepts/`, and
  product requirements, product-surface planning, and validation expectations in `product/`.
- When README content grows beyond orientation and common setup, update an existing guide, concept,
  or product document before creating a new document.
- Generated TypeDoc owns exhaustive API reference; authored docs explain integration paths, tasks,
  decisions, and mechanics.

## Directory READMEs

- Treat directory `README.md` files as navigation indexes.
- Keep frontmatter `children`, visible list order, and one-sentence child descriptions aligned.
- When adding, moving, or removing docs, update the nearest directory README and affected links.
- Preserve observed index headings and frontmatter `title` values matching the visible `#` heading.

## Writing and links

- Write for engineers integrating the SDK into consumer applications.
- Lead with the reader goal, keep minimum viable runnable paths before setup variants and advanced
  concerns, and explain consequences behind constraints.
- In guides, a minimum viable runnable path proves one primary result. Do not use it to preview
  optional SDK features that have their own later guide sections.
- Separate SDK responsibilities from application responsibilities, especially fetching, consent
  policy, identity policy, routing, and rendering.
- Link from guides to concepts for deeper mechanics after the reader has the task context that makes
  the concept useful. Do not make concept reading a prerequisite for a default guide path unless the
  reader must understand it before acting.
- In guides, do not place concept links in the opening before quick-start material unless the
  concept is required for safe action. Put deeper mechanics links after the relevant step or in a
  `## Learn more` section.
- Guides, concepts, and product documents may link to docs, package READMEs, implementation READMEs,
  and generated reference docs, but not directly to source code, tests, generated outputs, or source
  line numbers.

## Validate

- For moved or newly linked documents, verify repository-local relative links resolve.
