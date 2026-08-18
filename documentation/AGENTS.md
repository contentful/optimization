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
- `children` order is the published sidebar order, not just a list. It is authored in reader-routing
  order, so reordering it reorders the public documentation site.

## Publishing to the documentation site

Everything in `guides/` and `concepts/` publishes to `contentful/contentful-docs` through
`pnpm docs:fern`. Run `pnpm fern:check` after editing either directory.

- Every published document needs a `fern:` frontmatter block: `slug`, `section` (`Guides`,
  `Concepts`, or `Migration guides`), and `description`. Add `navTitle` only when the sidebar needs a
  shorter label than the page title.
- The published page title is the document's `# ` heading. There is no `fern.title`, so the title
  cannot drift from the heading; `pnpm fern:check` rejects one if it is reintroduced, and rejects an
  authored top-level `title` that no longer matches the heading.
- `fern.slug` is data and is never derived from a heading, so rewording an `#` heading cannot move a
  live URL. Changing a slug requires `pnpm docs:fern -- --update-lock`, which records a permanent
  redirect in `documentation/fern-slugs.lock.json`. `pnpm fern:check` fails on an unrecorded change.
- Cross-document links must resolve to a published document, and a `#fragment` must match a real
  heading on the target page. Never link a published document to `authoring/` or `internal/`.
- Do not hand-edit the pages in `contentful-docs`; they are generated and the next sync overwrites
  them. Prose changes belong here.
- Keep raw markup out of prose. Published pages become MDX, where `<` and `{` are active syntax, so
  angle-bracket placeholders belong inside inline code or a fenced block.

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
- Treat reference implementations as maintained validation evidence and comparison targets for
  supported integration paths. Do not frame them as optional examples, disposable samples, or
  lower-stakes app code.
- Guides, concepts, and product documents may link to docs, package READMEs, implementation READMEs,
  and generated reference docs, but not directly to source code, tests, generated outputs, or source
  line numbers.

## Validate

- For moved or newly linked documents, verify repository-local relative links resolve.
