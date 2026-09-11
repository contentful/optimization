/**
 * Discovery and frontmatter model for the docs that publish to the Fern site.
 *
 * The `fern:` frontmatter block is authored in this repo and is the only source of site-facing
 * metadata: sidebar label, URL slug, sidebar section, and meta description. The page title is the
 * document's `#` heading, so there is no second place for it to drift. Slugs are
 * data, never derived from a heading, so rewording an H1 can never silently move a live URL.
 *
 * Frontmatter is parsed by a deliberately strict reader rather than a YAML library: the block shape
 * is closed (this repo authors it and `pnpm fern:check` validates it), and anything outside that
 * shape must fail loudly instead of being silently misread.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fenceMask, headingAnchor, headingsOf } from '../sdk-knowledge/markdown'

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const documentationDir = path.join(rootDir, 'documentation')

/** Sidebar sections under `Optimization SDK`, in the order they appear in the nav. */
export const FERN_SECTIONS = ['Guides', 'Concepts', 'Migration guides'] as const
export type FernSection = (typeof FERN_SECTIONS)[number]

/** Directories whose documents publish to the site, paired with the section index that orders them. */
export const PUBLISHED_GROUPS = ['guides', 'concepts'] as const
export type PublishedGroup = (typeof PUBLISHED_GROUPS)[number]

/** Index files inside a published group that are navigation, not content. */
const NON_CONTENT_FILES = new Set(['README.md', 'AGENTS.md'])

/** The heading the exporter inserts for the intro prose, so every page has an anchor for it. */
export const OVERVIEW_ANCHOR = 'overview'

export interface FernMeta {
  /** The published page title. Always the document's `#` heading. */
  title: string
  /** Shorter sidebar label; absent when the sidebar reuses the page title. */
  navTitle?: string
  slug: string
  section: FernSection
  description: string
}

export interface PublishedDoc {
  /** Repo-relative source path, e.g. `documentation/guides/choosing-the-right-sdk.md`. */
  relPath: string
  group: PublishedGroup
  /** Source basename without extension. */
  name: string
  fern: FernMeta
  /** The `# ` heading. The site renders it as the page title via frontmatter, not as an H1. */
  heading: string
  /** Body lines with the frontmatter removed. */
  bodyLines: string[]
  /** Anchors a sibling document may link to on this page. */
  anchors: ReadonlySet<string>
  /** Position within `fern.section`, taken from the group README `children:` order. */
  order: number
}

export class DocError extends Error {
  constructor(relPath: string, message: string) {
    super(`${relPath}: ${message}`)
    this.name = 'DocError'
  }
}

interface RawFrontmatter {
  /** Top-level keys other than `fern`, preserved so callers can read an authored `title`. */
  top: Map<string, string>
  fern: Map<string, string>
  bodyLines: string[]
}

const FRONTMATTER_FENCE = '---'
const FERN_KEY_INDENT = '  '
const FERN_BLOCK_INDENT = '    '
const FERN_BLOCK_KEY = 'fern:'
const FOLDED_BLOCK_MARKER = '>-'
const CHILDREN_KEY = 'children:'

/** Locates the closing `---`, rejecting a file without a well-formed frontmatter block. */
function closingFenceIndex(relPath: string, lines: readonly string[]): number {
  if (lines[0] !== FRONTMATTER_FENCE) {
    throw new DocError(relPath, 'missing `---` frontmatter block')
  }
  const closing = lines.indexOf(FRONTMATTER_FENCE, 1)
  if (closing === -1) {
    throw new DocError(relPath, 'unterminated `---` frontmatter block')
  }
  return closing
}

/** Appends one continuation line of a `>-` folded block, which YAML rejoins with a space. */
function appendFolded(fern: Map<string, string>, key: string, line: string): void {
  const previous = fern.get(key) ?? ''
  fern.set(key, previous === '' ? line.trim() : `${previous} ${line.trim()}`)
}

/** Reads one `fern:` child line, returning the key when the line opens a folded block. */
function readNestedLine(
  relPath: string,
  fern: Map<string, string>,
  line: string,
): string | undefined {
  const nested = /^ {2}([A-Za-z]+):\s*(.*)$/u.exec(line)
  const [, key, rawValue] = nested ?? []
  if (key === undefined) {
    throw new DocError(relPath, `unsupported \`fern:\` line: ${line.trim()}`)
  }
  const value = (rawValue ?? '').trim()
  if (value === FOLDED_BLOCK_MARKER) {
    fern.set(key, '')
    return key
  }
  fern.set(key, unquote(value))
  return undefined
}

/** Reads one top-level frontmatter scalar, such as the authored `title`. */
function readTopLine(relPath: string, top: Map<string, string>, line: string): void {
  const scalar = /^([A-Za-z][A-Za-z-]*):\s*(.*)$/u.exec(line)
  const [, key, rawValue] = scalar ?? []
  if (key === undefined) {
    throw new DocError(relPath, `unsupported frontmatter line: ${line.trim()}`)
  }
  top.set(key, unquote((rawValue ?? '').trim()))
}

/**
 * Splits `---` frontmatter from the body and reads the closed key set this repo authors. Understands
 * exactly two value forms — a plain scalar and a `>-` folded block — and throws on anything else so
 * an unexpected shape can never be silently dropped from the published page.
 */
function readFrontmatter(relPath: string, text: string): RawFrontmatter {
  const lines = text.split('\n')
  const closing = closingFenceIndex(relPath, lines)

  const top = new Map<string, string>()
  const fern = new Map<string, string>()
  let inFern = false
  let foldingKey: string | undefined = undefined

  for (let index = 1; index < closing; index += 1) {
    const { [index]: raw } = lines
    const line = raw ?? ''

    if (foldingKey !== undefined && line.startsWith(FERN_BLOCK_INDENT)) {
      appendFolded(fern, foldingKey, line)
      continue
    }
    foldingKey = undefined

    if (line === FERN_BLOCK_KEY) {
      inFern = true
      continue
    }

    if (line.startsWith(FERN_KEY_INDENT)) {
      if (!inFern) {
        throw new DocError(relPath, `indented frontmatter line outside \`fern:\`: ${line.trim()}`)
      }
      foldingKey = readNestedLine(relPath, fern, line)
      continue
    }

    inFern = false
    readTopLine(relPath, top, line)
  }

  return { top, fern, bodyLines: lines.slice(closing + 1) }
}

/** Removes the single-quoting the exporter and authors use for values YAML would misread. */
function unquote(value: string): string {
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/gu, "'")
  }
  return value
}

function requireFernValue(relPath: string, fern: Map<string, string>, key: string): string {
  const value = fern.get(key)
  if (value === undefined || value === '') {
    throw new DocError(relPath, `frontmatter \`fern.${key}\` is required and must not be empty`)
  }
  return value
}

function assertSection(relPath: string, value: string): FernSection {
  const match = FERN_SECTIONS.find((section) => section === value)
  if (match === undefined) {
    throw new DocError(
      relPath,
      `frontmatter \`fern.section\` must be one of ${FERN_SECTIONS.join(', ')}, got "${value}"`,
    )
  }
  return match
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u

/**
 * Reads the `children:` list from a group README. That list is authored in reader-routing order and
 * is already validated by `pnpm guides:check`, so it — not the filesystem or alphabetical order — is
 * what orders the site sidebar.
 */
function readChildOrder(group: PublishedGroup): string[] {
  const relPath = `documentation/${group}/README.md`
  const lines = readFileSync(path.join(documentationDir, group, 'README.md'), 'utf8').split('\n')
  const closing = closingFenceIndex(relPath, lines)
  const children = collectChildren(lines.slice(1, closing))

  if (children.length === 0) {
    throw new DocError(relPath, 'frontmatter `children:` list is empty or missing')
  }
  return children
}

/** Collects `- ./name.md` items under the `children:` key, ignoring sibling frontmatter keys. */
function collectChildren(frontmatterLines: readonly string[]): string[] {
  const children: string[] = []
  let inChildren = false

  for (const line of frontmatterLines) {
    if (line === CHILDREN_KEY) {
      inChildren = true
      continue
    }
    const item = /^\s+-\s+\.\/(.+\.md)\s*$/u.exec(line)
    const [, fileName] = item ?? []
    if (inChildren && fileName !== undefined) {
      children.push(fileName)
      continue
    }
    if (!line.startsWith(' ')) {
      inChildren = false
    }
  }

  return children
}

function loadDoc(group: PublishedGroup, fileName: string, order: number): PublishedDoc {
  const relPath = `documentation/${group}/${fileName}`
  const text = readFileSync(path.join(documentationDir, group, fileName), 'utf8')
  const { top, fern, bodyLines } = readFrontmatter(relPath, text)

  const slug = requireFernValue(relPath, fern, 'slug')
  if (!SLUG_PATTERN.test(slug)) {
    throw new DocError(relPath, `frontmatter \`fern.slug\` must be kebab-case, got "${slug}"`)
  }

  // The page title is the `#` heading. A second copy under `fern:` could drift from it silently.
  if (fern.has('title')) {
    throw new DocError(
      relPath,
      'frontmatter `fern.title` is not supported: the published page title is the `# ` heading. Use `fern.navTitle` only when the sidebar needs a shorter label.',
    )
  }

  const headings = headingsOf(bodyLines)
  const h1 = headings.find((heading) => heading.level === 1)
  if (h1 === undefined) {
    throw new DocError(relPath, 'no `# ` heading found')
  }

  // documentation/AGENTS.md requires an authored `title` to match the visible heading.
  const authoredTitle = top.get('title')
  if (authoredTitle !== undefined && authoredTitle !== h1.text) {
    throw new DocError(
      relPath,
      `frontmatter \`title\` "${authoredTitle}" does not match the \`# \` heading "${h1.text}"`,
    )
  }

  const anchors = new Set<string>([OVERVIEW_ANCHOR])
  for (const heading of headings) {
    if (heading.level > 1) {
      anchors.add(headingAnchor(heading.text))
    }
  }

  const navTitle = fern.get('navTitle')
  return {
    relPath,
    group,
    name: fileName.replace(/\.md$/u, ''),
    fern: {
      title: h1.text,
      ...(navTitle === undefined || navTitle === '' ? {} : { navTitle }),
      slug,
      section: assertSection(relPath, requireFernValue(relPath, fern, 'section')),
      description: requireFernValue(relPath, fern, 'description'),
    },
    heading: h1.text,
    bodyLines,
    anchors,
    order,
  }
}

/**
 * Every document that publishes to the site, ordered within each sidebar section by its position in
 * the group README `children:` list. A file present on disk but absent from `children:` is an error
 * rather than a silent omission, so a new guide cannot be written and then quietly not published.
 */
export function loadPublishedDocs(): PublishedDoc[] {
  const docs: PublishedDoc[] = []

  for (const group of PUBLISHED_GROUPS) {
    const children = readChildOrder(group)
    children.forEach((fileName, index) => {
      if (NON_CONTENT_FILES.has(fileName)) {
        return
      }
      docs.push(loadDoc(group, fileName, index))
    })
  }

  return docs
}

/** Maps a source basename to its document, for resolving relative links between docs. */
export function bySourceName(docs: readonly PublishedDoc[]): Map<string, PublishedDoc> {
  const map = new Map<string, PublishedDoc>()
  for (const doc of docs) {
    map.set(`${doc.group}/${doc.name}`, doc)
  }
  return map
}

export { fenceMask, headingAnchor }
