/**
 * Emits the two site-configuration artifacts that must land in the same commit as the pages:
 * the `Optimization SDK` navigation block, and the redirect list.
 *
 * The nav block is emitted whole and spliced into `fern/products/personalization.yml` rather than
 * regenerating that file. The rest of that file is hand-maintained Personalization content that this
 * repo does not own, so rewriting it would churn sections we have no business touching.
 *
 * Slugs are tracked in a checked-in lock file. A slug that changes appends a permanent redirect: old
 * URLs have to keep resolving indefinitely, so the redirect list accumulates and is never pruned.
 */

import { FERN_SECTIONS, type FernSection, type PublishedDoc } from './docs'

/** Where the site keeps Optimization SDK pages, relative to `fern/products/personalization.yml`. */
const PAGE_PATH_PREFIX = '../docs/pages/personalization/optimization-sdk'

/** Published URL prefix. Redirects, unlike in-page links, carry the instance base path. */
const REDIRECT_PREFIX = '/developers/docs/personalization/optimization-sdk'

/** Indentation of `- section: Optimization SDK` inside the existing `navigation:` list. */
const BASE_INDENT = '  '

export const NAV_SECTION_TITLE = 'Optimization SDK'

/** The writer-owned landing page. This repo lists it in the nav but never generates its content. */
const OVERVIEW_ENTRY = { title: 'Overview', file: 'index', slug: 'overview' } as const

export interface SlugLock {
  /** Current slug per source document path. */
  slugs: Record<string, string>
  /** Every slug that has ever changed, oldest first. Append-only. */
  redirects: Array<{ from: string; to: string }>
}

export function emptyLock(): SlugLock {
  return { slugs: {}, redirects: [] }
}

/**
 * Reconciles the lock against the documents being published, appending a redirect for each slug that
 * moved. Returns the updated lock; callers persist it so the redirect survives future runs.
 */
export function reconcileLock(lock: SlugLock, docs: readonly PublishedDoc[]): SlugLock {
  const slugs: Record<string, string> = { ...lock.slugs }
  const redirects = [...lock.redirects]

  for (const doc of docs) {
    const { fern, relPath } = doc
    const { slug } = fern
    const { [relPath]: previous } = slugs
    if (previous !== undefined && previous !== slug) {
      const exists = redirects.some((entry) => entry.from === previous && entry.to === slug)
      if (!exists) {
        redirects.push({ from: previous, to: slug })
      }
    }
    slugs[relPath] = slug
  }

  return { slugs, redirects }
}

/**
 * Rewrites redirect chains to point at the current slug. If a page moved A -> B -> C, both A and B
 * must land on C; leaving A -> B would cost a hop and break if B is ever reused.
 */
function resolveRedirectTarget(
  from: string,
  redirects: ReadonlyArray<{ from: string; to: string }>,
): string {
  const seen = new Set<string>([from])
  let target = from
  for (;;) {
    // A per-iteration binding, so the predicate never closes over the mutated `target`.
    const current = target
    const next = redirects.find((entry) => entry.from === current)
    if (next === undefined || seen.has(next.to)) {
      return target
    }
    const { to } = next
    seen.add(to)
    target = to
  }
}

/** The `redirects:` entries to merge into `fern/docs.yml`, in the site's quoted absolute form. */
export function renderRedirects(lock: SlugLock): string[] {
  const lines: string[] = []
  for (const entry of lock.redirects) {
    const destination = resolveRedirectTarget(entry.from, lock.redirects)
    if (destination === entry.from) {
      continue
    }
    lines.push(
      `${BASE_INDENT}- source: "${REDIRECT_PREFIX}/${entry.from}/"`,
      `${BASE_INDENT}  destination: "${REDIRECT_PREFIX}/${destination}/"`,
    )
  }
  return lines
}

function pageEntry(indent: string, title: string, file: string, slug: string): string[] {
  return [
    `${indent}- page: ${title}`,
    `${indent}  path: ${PAGE_PATH_PREFIX}/${file}.mdx`,
    `${indent}  slug: ${slug}`,
  ]
}

function docsInSection(docs: readonly PublishedDoc[], section: FernSection): PublishedDoc[] {
  return docs
    .filter((doc) => doc.fern.section === section)
    .sort((left, right) => left.order - right.order)
}

/**
 * Renders the whole `- section: Optimization SDK` block.
 *
 * The inner sections set `skip-slug: true`, so `Guides`/`Concepts`/`Migration guides` group the
 * sidebar without adding a URL segment — page URLs stay `optimization-sdk/<slug>`, which is what the
 * existing published links already assume.
 */
export function renderNavBlock(docs: readonly PublishedDoc[]): string[] {
  const sectionIndent = `${BASE_INDENT}    `
  const pageIndent = `${BASE_INDENT}        `
  const lines: string[] = [
    `${BASE_INDENT}- section: ${NAV_SECTION_TITLE}`,
    `${BASE_INDENT}  collapsed: true`,
    `${BASE_INDENT}  contents:`,
    ...pageEntry(sectionIndent, OVERVIEW_ENTRY.title, OVERVIEW_ENTRY.file, OVERVIEW_ENTRY.slug),
  ]

  for (const section of FERN_SECTIONS) {
    const inSection = docsInSection(docs, section)
    if (inSection.length === 0) {
      continue
    }
    lines.push(
      `${sectionIndent}- section: ${section}`,
      `${sectionIndent}  collapsed: true`,
      `${sectionIndent}  skip-slug: true`,
      `${sectionIndent}  contents:`,
    )
    for (const doc of inSection) {
      lines.push(
        ...pageEntry(pageIndent, doc.fern.navTitle ?? doc.fern.title, doc.fern.slug, doc.fern.slug),
      )
    }
  }

  return lines
}
