/**
 * Turns one authored markdown document into the MDX page the Fern site publishes.
 *
 * Every pass here is deterministic and structural. Prose is never reflowed or reworded: the authored
 * text in `documentation/` is the source of truth for wording, and a transform that rewrote sentences
 * would make the two copies impossible to diff. What this owns is frontmatter, the heading shape the
 * site expects, callout components, and links.
 *
 * All line-based passes consult `fenceMask` so a Swift `#if DEBUG`, a JSX `<h1>` in an example, or a
 * shell `# comment` inside a fenced block is never treated as prose.
 */

import { fenceMask } from '../sdk-knowledge/markdown'
import { OVERVIEW_ANCHOR, type PublishedDoc } from './docs'

/** Site path prefix. The Fern instance base path supplies `/developers/docs`, so pages omit it. */
export const SITE_BASE = '/personalization/optimization-sdk'

/** The site's hand-authored landing page, which is also the guides index. */
export const OVERVIEW_SLUG = 'overview'

export const GITHUB_REPO_URL = 'https://github.com/contentful/optimization'

/** Code-fence languages the site publishes. Aliases are rejected so tags stay consistent. */
export const CANONICAL_FENCE_LANGUAGES = new Set([
  'diff',
  'dotenv',
  'graphql',
  'html',
  'js',
  'json',
  'jsx',
  'kotlin',
  'sh',
  'swift',
  'text',
  'ts',
  'tsx',
  'xml',
])

/** GitHub alert types mapped to the Fern component that carries the same severity. */
const ALERT_COMPONENTS: Record<string, string> = {
  NOTE: 'Info',
  TIP: 'Info',
  IMPORTANT: 'Warning',
  WARNING: 'Warning',
  CAUTION: 'Warning',
}

/** Components the exporter is allowed to emit; anything else outside a fence is an MDX hazard. */
const ALLOWED_COMPONENTS = new Set(Object.values(ALERT_COMPONENTS))

export interface TransformProblem {
  line: number
  message: string
}

export interface TransformResult {
  mdx: string
  problems: TransformProblem[]
}

export interface TransformOptions {
  /** Git ref that repo-relative links are pinned to, e.g. `main` or a release tag. */
  ref: string
  /** Every published document, for resolving links and validating anchors. */
  docsBySourceName: ReadonlyMap<string, PublishedDoc>
}

/** Escapes the small set of characters that would break a single-line YAML scalar. */
function yamlScalar(value: string): string {
  if (/:\s/u.test(value) || /^[&*?|\->%@`!{}[\],#"']/u.test(value) || value.trim() !== value) {
    return `'${value.replace(/'/gu, "''")}'`
  }
  return value
}

/**
 * Folds a description onto continuation lines so the emitted frontmatter stays inside the repo's
 * 100-column budget without a YAML library.
 */
function foldedScalar(key: string, value: string, width = 100): string[] {
  const indent = '  '
  const words = value.split(/\s+/u)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current === '' ? word : `${current} ${word}`
    if (indent.length + candidate.length > width && current !== '') {
      lines.push(indent + current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current !== '') {
    lines.push(indent + current)
  }
  return [`${key}: >-`, ...lines]
}

/** The site reads only `title` and `description`; slug and sidebar label live in the nav YAML. */
function frontmatterFor(doc: PublishedDoc): string[] {
  return [
    '---',
    `title: ${yamlScalar(doc.fern.title)}`,
    ...foldedScalar('description', doc.fern.description),
    '---',
  ]
}

/**
 * Removes the generated collapsible table of contents. Fern renders its own page TOC, and the `mtoc`
 * markers must stay in the source file, so this strip happens only on the way out.
 */
function stripTableOfContents(lines: string[]): string[] {
  const start = lines.findIndex(
    (line, index) =>
      /^\s*<details>\s*$/u.test(line) &&
      /<summary>\s*Table of Contents\s*<\/summary>/u.test(lines[index + 1] ?? ''),
  )
  if (start === -1) {
    return lines
  }
  const end = lines.findIndex((line, index) => index > start && /^\s*<\/details>\s*$/u.test(line))
  if (end === -1) {
    return lines
  }
  // Collapse the blank line that followed the block so the strip leaves no double gap.
  const after = lines[end + 1] === '' ? end + 2 : end + 1
  return [...lines.slice(0, start), ...lines.slice(after)]
}

/**
 * Replaces the `# ` heading with `## Overview`. The site takes the page title from frontmatter, and
 * every published page opens with an `Overview` section over the intro prose.
 */
function replaceHeadingWithOverview(lines: string[], problems: TransformProblem[]): string[] {
  const inFence = fenceMask(lines)
  const index = lines.findIndex((line, at) => inFence[at] !== true && /^#\s+\S/u.test(line))
  if (index === -1) {
    problems.push({ line: 1, message: 'no `# ` heading to convert into `## Overview`' })
    return lines
  }
  return [...lines.slice(0, index), '## Overview', ...lines.slice(index + 1)]
}

/** The Fern component for a `> [!TYPE]` marker line, or undefined when the line is not one. */
function alertComponent(line: string): string | undefined {
  const alert = /^>\s*\[!([A-Z]+)\]\s*$/u.exec(line)
  const [, type] = alert ?? []
  return type === undefined ? undefined : ALERT_COMPONENTS[type]
}

/**
 * Consumes the blockquote body following an alert marker, dropping the `>` prefix, the blank spacer
 * line GitHub requires after the marker, and any trailing blank lines.
 */
function readAlertBody(lines: readonly string[], start: number): { body: string[]; next: number } {
  const body: string[] = []
  let cursor = start

  while (cursor < lines.length) {
    const { [cursor]: raw } = lines
    const line = raw ?? ''
    if (!line.startsWith('>')) {
      break
    }
    const stripped = line.replace(/^>\s?/u, '')
    if (stripped.trim() !== '' || body.length > 0) {
      body.push(stripped)
    }
    cursor += 1
  }

  while (body.length > 0 && (body[body.length - 1] ?? '').trim() === '') {
    body.pop()
  }

  return { body, next: cursor }
}

/**
 * Converts GitHub alert blockquotes into Fern callout components, preserving severity. Line wrapping
 * inside the block is left as authored — it renders identically and keeps the diff readable.
 */
function convertAlerts(lines: string[]): string[] {
  const inFence = fenceMask(lines)
  const output: string[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const { [index]: raw } = lines
    const line = raw ?? ''
    const component = inFence[index] === true ? undefined : alertComponent(line)

    if (component === undefined) {
      output.push(line)
      continue
    }

    const { body, next } = readAlertBody(lines, index + 1)
    output.push(`<${component}>`, ...body, `</${component}>`)
    index = next - 1
  }

  return output
}

interface LinkTarget {
  href: string
  problem?: string
}

/** In-page anchors, `scheme:` URLs, and protocol-relative URLs are already site-correct. */
function isAlreadyAbsolute(target: string): boolean {
  return target.startsWith('#') || /^[a-z][a-z\d+.-]*:/iu.test(target) || target.startsWith('//')
}

/** Directories that exist only to compose the published docs and must never be linked from them. */
function isInternalOnly(resolved: string): boolean {
  return (
    resolved.startsWith('documentation/authoring/') ||
    resolved.startsWith('documentation/internal/')
  )
}

/** A group README, which the site represents with its Optimization SDK landing page. */
function isGroupIndex(resolved: string): boolean {
  return (
    resolved === 'documentation/guides/README.md' || resolved === 'documentation/concepts/README.md'
  )
}

function publishedDocFor(resolved: string, options: TransformOptions): PublishedDoc | undefined {
  const match = /^documentation\/(guides|concepts)\/(.+)\.md$/u.exec(resolved)
  const [, group, name] = match ?? []
  if (group === undefined || name === undefined) {
    return undefined
  }
  return options.docsBySourceName.get(`${group}/${name}`)
}

/**
 * Resolves one authored link target to what it must become on the site.
 *
 * Anchors are appended after the canonical trailing slash (`/slug/#anchor`). The manual process
 * appended the slash after the fragment instead, which silently broke every deep link.
 */
function resolveLink(target: string, from: PublishedDoc, options: TransformOptions): LinkTarget {
  if (isAlreadyAbsolute(target)) {
    return { href: target }
  }

  const [rawPath = '', fragment] = target.split('#', 2)
  const resolved = normalizeRelative(from.relPath, rawPath)

  if (isInternalOnly(resolved)) {
    return { href: target, problem: `links to internal-only ${resolved}, which is not published` }
  }
  if (isGroupIndex(resolved)) {
    return { href: sitePath(OVERVIEW_SLUG, undefined) }
  }

  const doc = publishedDocFor(resolved, options)
  if (doc === undefined) {
    // Anything else in the repo (package and implementation READMEs, product docs) is only reachable
    // on GitHub, pinned to the ref being published.
    const suffix = fragment === undefined ? '' : `#${fragment}`
    return { href: `${GITHUB_REPO_URL}/blob/${options.ref}/${resolved}${suffix}` }
  }

  const href = sitePath(doc.fern.slug, fragment)
  if (fragment !== undefined && !doc.anchors.has(fragment)) {
    return {
      href,
      problem: `link to ${resolved}#${fragment} has no matching heading on that page`,
    }
  }
  return { href }
}

function sitePath(slug: string, fragment: string | undefined): string {
  return `${SITE_BASE}/${slug}/${fragment === undefined ? '' : `#${fragment}`}`
}

/** Resolves a relative link against the linking document, returning a repo-relative path. */
function normalizeRelative(fromRelPath: string, target: string): string {
  const segments = fromRelPath.split('/').slice(0, -1)
  for (const segment of target.split('/')) {
    if (segment === '.' || segment === '') {
      continue
    }
    if (segment === '..') {
      segments.pop()
      continue
    }
    segments.push(segment)
  }
  return segments.join('/')
}

/** Rewrites every inline and reference link outside fenced code. */
function rewriteLinks(
  lines: string[],
  doc: PublishedDoc,
  options: TransformOptions,
  problems: TransformProblem[],
): string[] {
  const inFence = fenceMask(lines)

  return lines.map((line, index) => {
    if (inFence[index] === true) {
      return line
    }
    return line.replace(/\]\(([^)\s]+)\)/gu, (_whole, target: string) => {
      const { href, problem } = resolveLink(target, doc, options)
      if (problem !== undefined) {
        problems.push({ line: index + 1, message: problem })
      }
      return `](${href})`
    })
  })
}

/** Rejects fences with a missing or non-canonical language tag. */
function checkFenceLanguages(lines: string[], problems: TransformProblem[]): void {
  let open = false
  lines.forEach((line, index) => {
    const fence = /^\s*```(\S*)\s*$/u.exec(line)
    if (fence === null) {
      return
    }
    if (open) {
      open = false
      return
    }
    open = true
    const language = fence[1] ?? ''
    if (language === '') {
      problems.push({ line: index + 1, message: 'fenced code block has no language tag' })
    } else if (!CANONICAL_FENCE_LANGUAGES.has(language)) {
      problems.push({
        line: index + 1,
        message: `non-canonical code-fence language "${language}"`,
      })
    }
  })
}

/**
 * Fails on raw markup that MDX would parse as JSX. This is the gate that catches leaked tool
 * scaffolding such as `</content>` and angle-bracket placeholders left outside inline code.
 *
 * Inline code spans are removed first over the joined text, because an authored span may wrap across
 * a line break (`` `... "<contentType>" where "fields.<slugField>" ...` ``) and a per-line scan would
 * misread its contents as markup.
 */
function checkMdxSafety(lines: string[], problems: TransformProblem[]): void {
  const inFence = fenceMask(lines)
  const prose = lines.map((line, index) => (inFence[index] === true ? '' : line))
  const withoutCode = prose.join('\n').replace(/`[^`]*`/gu, '')

  withoutCode.split('\n').forEach((line, index) => {
    for (const match of line.matchAll(/<\/?([A-Za-z][A-Za-z0-9]*)/gu)) {
      const tag = match[1] ?? ''
      if (!ALLOWED_COMPONENTS.has(tag)) {
        problems.push({
          line: index + 1,
          message: `raw <${tag}> outside a code fence would be parsed as JSX by MDX`,
        })
      }
    }
  })
}

/** Runs every pass and returns the page plus anything that must be fixed at the source. */
export function transformDoc(doc: PublishedDoc, options: TransformOptions): TransformResult {
  const problems: TransformProblem[] = []

  let lines = stripTableOfContents(doc.bodyLines)
  lines = replaceHeadingWithOverview(lines, problems)
  lines = convertAlerts(lines)
  lines = rewriteLinks(lines, doc, options, problems)

  checkFenceLanguages(lines, problems)
  checkMdxSafety(lines, problems)

  // Drop leading blank lines so the frontmatter is followed by exactly one gap.
  while ((lines[0] ?? '').trim() === '') {
    lines = lines.slice(1)
  }

  const body = lines
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trimEnd()
  return { mdx: `${[...frontmatterFor(doc), '', body].join('\n')}\n`, problems }
}

export { OVERVIEW_ANCHOR }
