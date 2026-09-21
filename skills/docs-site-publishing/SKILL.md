---
name: docs-site-publishing
description: >-
  Wire an authored document under documentation/guides/ or documentation/concepts/ into the published
  Contentful documentation site. Covers the four things that decide whether a page reaches the site at
  all — the group README `children:` list, the `fern:` frontmatter block, the slug lock, and MDX
  safety — plus the sidebar ordering rule and the release-gated three-layer sync. Use when adding,
  renaming, moving, retitling, reordering, or removing a published document, when changing a
  `fern.slug` or `fern.section`, when editing a group README index, or when `pnpm fern:check` fails.
  Triggers on "publish the guide", "is this exported", "fern", "fern:check", "frontmatter", "slug",
  "fern-slugs.lock", "sidebar order", "nav", "redirect", "contentful-docs", "why isn't my page on the
  site". Not guide prose or structure (optimization-guide-authoring) and not fact derivation
  (sdk-knowledge-authoring).
argument-hint: '[document, group README, or the failing fern:check output]'
paths: documentation/guides/**, documentation/concepts/**, documentation/fern-slugs.lock.json
---

# Publishing authored docs to the documentation site

Use this skill with `optimization-guide-authoring`. That skill owns what a guide says and how it
reads; this one owns whether it reaches `contentful/contentful-docs` and stays at a stable URL.
`documentation/AGENTS.md` holds the same contract as repository policy — when the two disagree, that
file wins and this skill should be corrected.

Writing a good document is not publishing it. Publication is data: four separate artifacts have to
agree, and three of the four fail silently or late if you skip them.

## The publishing contract

A document under `documentation/guides/` or `documentation/concepts/` publishes only when **all** of
these hold. `pnpm fern:check` enforces every one of them, so treat a failure as the contract talking.

1. **It is listed in its group `README.md` frontmatter `children:`.** The exporter never scans the
   filesystem (`loadPublishedDocs` in `scripts/fern/docs.ts` reads `children:` and nothing else). A
   file on disk but missing from `children:` is not published — it is invisible, not an error, which
   is why this is the easiest step to lose.
2. **It has a `fern:` frontmatter block** with `slug`, `section`, and `description`. Add `navTitle`
   only when the sidebar needs a shorter label than the page title.
3. **Its slug is recorded in `documentation/fern-slugs.lock.json`.** Run
   `pnpm docs:fern -- --update-lock` and commit the result in the same change as the page.
4. **Its prose is MDX-safe**, and every cross-document link resolves to a published page and a real
   heading anchor on it.

### The `fern:` block

```markdown
---
fern:
  slug: migrate-optimization-sdk-v1-to-v2
  section: Migration guides
  description: >-
    One or two sentences of meta description, in the same voice as the page's opening.
---

# Migrate Optimization SDK packages from v1 to v2
```

- `section` is exactly one of `Guides`, `Concepts`, `Migration guides`. It is the **sidebar** section
  and is independent of which directory the file lives in — a `Migration guides` page lives under
  `guides/`, not in a directory of its own.
- `slug` is kebab-case and is **data, never derived from the heading**. That is the whole point:
  rewording an `#` heading can then never move a live URL.
- There is no `fern.title`. The published title is the document's `# ` heading, so it cannot drift
  from what the reader sees; `fern:check` rejects a reintroduced `fern.title` outright. A group
  README's top-level `title:` must match its own `#` heading.
- `description` is a `>-` folded block. The frontmatter reader is deliberately strict and understands
  only a plain scalar and `>-` — any other YAML shape is a hard error rather than a silent drop.

### The slug lock

`documentation/fern-slugs.lock.json` maps source path → slug, and is the only record of what URL a
page has already occupied. Two cases, one command:

- **New page** — the lock gains an entry. Nothing about the page changes; what changes is that the
  slug is now protected.
- **Changed slug** — the lock records a permanent redirect from the old slug to the new one, so the
  live URL keeps working.

Both: `pnpm docs:fern -- --update-lock`, then commit the lock diff **with the page**. Never hand-edit
the lock; the redirect chain is resolved and validated from it, and a history the exporter cannot
explain fails the check.

> Why the entry matters for a page that is not live yet: the exporter reconciles an unrecorded
> document in memory, so the page publishes either way. But the change check can only compare against
> a slug the lock names, and the sync workflow runs `pnpm docs:fern` **without** `--update-lock` — so
> an entry the author never commits never appears. Without it, the page's first slug reword moves a
> live URL with no redirect, which is exactly what the lock exists to prevent.

### Sidebar order

`children:` order **is** the published sidebar order, authored in reader-routing order. Two
consequences worth stating because neither is obvious:

- Reordering `children:` reorders the public site. It is not a local bookkeeping list.
- Order is **global across the group**, not per section. A page's position within its `section` comes
  from its index in the one `children:` list, so inserting a `Migration guides` page second in
  `documentation/guides/README.md` puts it **first** in the Migration guides sidebar section. Place it
  where you want it to land in its own section, and keep `children:`, the visible list order, and the
  one-sentence descriptions aligned (`pnpm guides:check` enforces the alignment).

### MDX safety and links

Published pages become MDX, where `<` and `{` are active syntax.

- Keep angle-bracket placeholders inside inline code or a fenced block. Never bare in prose.
- Every fenced block needs a language tag.
- Cross-document links must resolve to a published document, and any `#fragment` must match a real
  heading on the target page. The exporter promotes the intro prose under an `## Overview` heading, so
  `#overview` is always available.
- **Never link a published page to `authoring/` or `internal/`.** Those are not published; the link
  would 404 on the site. This is the one link rule a repo-local check would otherwise call valid.

## How a change reaches the site

Three layers, each runnable on its own, none needing credentials except the last:

1. `pnpm docs:fern` — builds the bundle into gitignored `fern-bundle/`: one `.mdx` per page,
   `nav-block.yaml`, `redirects.yaml`, `manifest.json`. Pure local transform.
2. `pnpm docs:fern:apply` — writes that bundle into a `contentful-docs` checkout.
3. `.github/workflows/sync-fern-docs.yaml` — opens the pull request on `contentful/contentful-docs`.

**Publication is release-gated.** An edit merged to `main` reaches the public site at the next
release, not on merge; a maintainer can publish out of band by dispatching the sync workflow from
`main`. So "merged" and "live" are different states — say which one you mean when reporting.

Do not hand-edit pages in `contentful-docs`. They are generated and the next sync overwrites them;
prose changes belong here.

## Workflow

1. **Author the page**, following `optimization-guide-authoring`.
2. **Add the `fern:` block** — `slug`, `section`, `description`.
3. **Add it to `children:`** in the group README, positioned where it should appear in its own
   sidebar section, and add its row plus one-sentence description to the visible list.
4. **Record the slug**: `pnpm docs:fern -- --update-lock`.
5. **Validate**: `pnpm fern:check`, then `pnpm guides:check`. Read the reported `file:line: message`
   rather than guessing — the messages name the exact fix, including the command to run.
6. **Inspect the bundle** when the page is new or its slug, section, or order changed. `pnpm docs:fern`
   then read `fern-bundle/nav-block.yaml` to confirm the page sits in the section and position you
   intended, and `fern-bundle/pages/<slug>.mdx` to confirm the title and description resolved. The nav
   block is the artifact that actually ships; reading it is how you check ordering instead of
   reasoning about `children:` indices.
7. **Commit the page, the README, and the lock together.** A page without its README entry is
   unpublished; a page without its lock entry is unprotected.

## Reporting

Say which of these you did, because they are separately verifiable and readers of the summary cannot
tell from "docs updated":

- whether the page is wired into `children:` and at what sidebar position
- whether the lock entry was recorded, and whether any redirect was appended
- which checks ran and passed
- that publication happens at the next release, not on merge

## Not in scope

- Guide prose, structure, archetypes, example labels → `optimization-guide-authoring`
- Migration-guide routing and blueprints → `migration-guide-authoring`
- SDK or migration fact derivation → `sdk-knowledge-authoring`, `migration-knowledge-authoring`
- The `contentful-docs` repository's own conventions and its nav-orphan checks
