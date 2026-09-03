# Generate the public documentation site content from this repository

- Status: Accepted
- Scope: Optimization SDK Suite documentation

## Context

`documentation/guides/` and `documentation/concepts/` are the authored source for the Optimization SDK
documentation published at `contentful.com/developers/docs/personalization/optimization-sdk`. That
site lives in `contentful/contentful-docs` and uses Fern, so the content had to be copied across
repositories by hand: links rewritten, pages restructured, slugs renamed, frontmatter added.

The copies drifted. Measured against the published site: 52 internal links pointed at 12 slugs that
did not exist, 16 GitHub URLs were malformed where a find-replace ate a path separator, 7 deep links
were broken by appending a trailing slash after the fragment, and all three GitHub alert severities
had collapsed into a single component. Two pages shipped an empty meta description.

The copying was also lossy rather than merely untidy. `isEmptyVariant` appeared 9 times and
`slugField` 7 times in the authored guides and zero times on the published site, so the Node SDK's
slug-based fetching and empty-variant handling were documented here and missing in public — both
having landed several days before the sync that should have carried them.

A second hand sync during this work changed none of those numbers, so the process was neither
degrading nor self-correcting. The drift is a property of doing the transform by hand at all.

## Decision

Generate the site content from this repository with a deterministic exporter, and treat the authored
markdown as the single source of truth for wording.

- The transform owns page frontmatter, the heading shape the site expects, callout components, link
  rewriting, and the navigation and redirect configuration. It never rewrites prose.
- Site-facing metadata lives in a `fern:` frontmatter block per document: `slug`, `section`,
  `description`, and `navTitle` only where a sidebar label must be shorter than the page title.
- The published page title is the document's `#` heading. There is no second key holding a title.
- Slugs are recorded data, never derived from a heading. Changing one requires an explicit
  `--update-lock` run, which appends a permanent redirect to `documentation/fern-slugs.lock.json`.
- Three layers, so the first two need no credentials: `pnpm docs:fern` builds a bundle,
  `pnpm docs:fern:apply` splices it into a local `contentful-docs` checkout, and a workflow wraps
  both to open a pull request there.
- `pnpm fern:check` gates the same pipeline in CI: every cross-document link must resolve to a
  published page, every fragment must match a real heading, no published page may link into
  `documentation/authoring/` or `documentation/internal/`, the MDX must be safe, and no slug may move
  without a recorded redirect.
- Publication is release-gated. The sync workflow is ref-parameterized, idempotent against one branch
  and one pull request, and concurrency-guarded.
- Authoring instructions own the conventions the transform depends on. `STYLE_GUIDE.md` holds the
  document-title rule; the archetype recipes defer to it rather than restating it.

## Alternatives considered and discarded

- **Keep copying by hand, with a checklist.** Discarded: the failure is silent. Nothing in either
  repository could tell a reviewer that a link resolved to nothing or that a documented SDK feature
  never shipped to the site.
- **Put the transform in `contentful-docs`.** Discarded: the source and the TypeScript tooling live
  here, that repository is JavaScript and declares itself docs-only, and its own guidelines push back
  on adding generation workflows. Its `GITHUB_TOKEN` would have avoided a cross-repository
  credential, which is the one real cost of deciding this way.
- **One workflow doing everything.** Discarded: nothing would be verifiable without a token, so every
  iteration would cost a CI round trip. Splitting the pure transform from delivery makes the whole
  corpus diffable against the live site locally.
- **Normalize or reflow prose as part of the transform.** Discarded: it would make the two copies
  impossible to diff, which is the only practical way to tell a transform bug from an editorial
  change.
- **Derive slugs from headings.** Discarded: rewording a heading would silently move a live URL. The
  reverse — deriving the page title from the heading — is safe and is what we do, because a retitled
  page should change its title.
- **Hold site metadata in one manifest file.** Discarded: it duplicates the ordering already authored
  in the group `README.md` `children:` lists and drifts from the documents it describes.
- **Keep an explicit `fern.title`.** Tried, then removed. Two copies of a title are a place to drift;
  `fern:check` now rejects the key outright.
- **Regenerate `fern/products/personalization.yml`.** Discarded: that file also holds hand-maintained
  Personalization content this repository does not own. The exporter splices only its own section.
- **Add a YAML dependency for frontmatter.** Discarded: the block shape is closed, authored here, and
  validated here, and the repository's existing validators parse markdown without parser
  dependencies. The trade-off is that the reader must fail loudly on anything unexpected, which it
  does.
- **Publish on every merge to `main` that touches documentation.** Discarded by the maintainer:
  documentation describes SDK behavior, and that behavior is only real to a reader once the package
  ships. Release-gating means a documentation-only fix waits for the next release, for which manual
  dispatch is the escape hatch.
- **Fan out naively from `on: release`.** Discarded: merging the grouped release pull request creates
  one GitHub release per component, so a single release moment fires the trigger several times. The
  workflow is idempotent and concurrency-guarded so those firings converge on one pull request.
- **Convert the gerund titles in the documents only.** Discarded: `recipes/integration.md` mandated
  the gerund form and the other three recipes stated no title form at all, so the pipeline would have
  regenerated what we had just corrected. The instruction layer was the actual defect.

## Consequences

- Pages under `fern/docs/pages/personalization/optimization-sdk/` in `contentful-docs` become
  generated output. Editing them there is overwritten by the next sync; wording changes belong in
  `documentation/`.
- Delivery needs a credential scoped to `contentful-docs` (`contents: write`,
  `pull-requests: write`). A GitHub App installation token is preferred over a long-lived token. A
  pull request from a branch in that repository also receives a Fern preview URL, which a fork cannot.
- `contentful-docs` is accepting generated content from another repository, which is a change to how
  that repository works and is its maintainers' decision to record, not ours.
- Sidebar order now comes from the authored `children:` lists, which are in reader-routing order. The
  published site was alphabetical, so the first sync reorders it.
- The site's `index.mdx` stays owned by the technical writers. It is hand-authored and derives from no
  source document, so the exporter lists it in navigation and never generates it.
- Editorial divergence already on the site is not resolved by this decision. Nine passages exist only
  in `contentful-docs` and are lost on first sync unless they are back-ported first. Reconciling them
  needs editorial judgement and is tracked separately.
