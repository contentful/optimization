---
name: docs-site-publishing
description: >-
  Wire a document under documentation/guides/ or documentation/concepts/ into the published Contentful
  documentation site. Use when adding, renaming, moving, reordering, or removing a published document,
  when editing a `fern:` frontmatter block, a group README `children:` list, or
  documentation/fern-slugs.lock.json, and when `pnpm fern:check` fails.
argument-hint: '[document, group README, or the failing fern:check output]'
paths: documentation/guides/**, documentation/concepts/**, documentation/fern-slugs.lock.json
---

# Publishing authored docs to the documentation site

Writing a document does not publish it. Publication is data, and two of its four requirements fail
silently — this skill exists for those two.

**Sources of truth** — read rather than restate:

- [`documentation/AGENTS.md`](../../documentation/AGENTS.md) "Publishing to the documentation site" —
  the rules: the `fern:` block, title-from-heading, slugs, links, MDX safety.
- [`docs/ADRs/0002`](../../docs/ADRs/0002-generate-the-public-documentation-site-content-from-this-repository.md)
  — why the exporter is shaped this way, and the three-layer sync.

## The two silent failures

**A document absent from its group README `children:` is not published.** The exporter reads that
list and never scans the filesystem, so the page is invisible rather than an error. Nothing fails; the
page simply never exists on the site.

**`children:` order is the sidebar order, and it is global across the group, not per section.** A
page's position inside its `fern.section` comes from its index in the one `children:` list — so
inserting a `Migration guides` page second in `documentation/guides/README.md` puts it _first_ in the
Migration guides sidebar section. Place it where it should land in its own section.

## Recording the slug

`pnpm docs:fern -- --update-lock`, then commit the lock diff **with the page**. This covers both a new
page and a changed slug; only the latter appends a redirect. Never hand-edit the lock.

A new page publishes without a lock entry, so this is easy to skip — but the slug then has no
protection, because the change check can only compare against a slug the lock already names. `pnpm
fern:check` rejects an unrecorded slug for that reason.

## Checks

`pnpm fern:check` enforces the whole contract and reports `file:line: message` naming the fix. It also
runs from the `Stop` hook whenever published docs change, so a missed step surfaces without being
asked for.

When a page is new or its slug, section, or order changed, run `pnpm docs:fern` and read
`fern-bundle/nav-block.yaml` — that is the artifact that ships, so it settles ordering questions that
reasoning about `children:` indices does not.

## Reporting

Publication is **release-gated**: an edit reaches the site at the next release, not on merge. Say
which state you mean, and say whether the page is wired into `children:` and whether the lock entry
was recorded — a reader cannot tell from "docs updated".

## Not in scope

Guide prose and structure (`optimization-guide-authoring`), migration routing
(`migration-guide-authoring`), fact derivation (`sdk-knowledge-authoring`), and the
`contentful-docs` repository's own conventions.
