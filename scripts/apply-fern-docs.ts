/**
 * Applies a built bundle into a `contentful-docs` checkout. Layer 2 of the sync.
 *
 * Still local and credential-free: it edits a working tree you already have, so the output can be
 * verified with that repo's own gates (`fern check`, `check-orphan-pages.js`, `check-redirects.js`,
 * `fern docs dev`) before any cross-repo automation is involved. Layer 3 is only a shell around this.
 *
 * Nav and redirects are spliced, never regenerated. `fern/products/personalization.yml` also holds
 * hand-maintained Personalization content this repo does not own, and rewriting the file would churn
 * sections we have no business touching.
 *
 * Usage:
 *   pnpm docs:fern:apply -- --docs-repo ../contentful-docs
 *   pnpm docs:fern:apply -- --docs-repo <path> --bundle fern-bundle --dry-run
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { NAV_SECTION_TITLE } from './fern/bundle'
import { rootDir } from './fern/docs'

const PAGES_SUBPATH = 'fern/docs/pages/personalization/optimization-sdk'
const NAV_SUBPATH = 'fern/products/personalization.yml'
const DOCS_CONFIG_SUBPATH = 'fern/docs.yml'
/** Marks the generated span inside the docs repo's redirect list. */
const REDIRECT_BEGIN = '  # BEGIN generated: Optimization SDK slug redirects'
const REDIRECT_END = '  # END generated: Optimization SDK slug redirects'
/** The writer-owned landing page, which this repo lists in nav but never generates. */
const WRITER_OWNED_PAGES = new Set(['index.mdx'])
const DEFAULT_BUNDLE_DIR = 'fern-bundle'

interface Options {
  docsRepo: string
  bundleDir: string
  dryRun: boolean
}

function parseArgs(argv: readonly string[]): Options {
  let docsRepo: string | undefined = undefined
  let bundleDir = DEFAULT_BUNDLE_DIR
  let dryRun = false

  for (let index = 0; index < argv.length; index += 1) {
    const { [index]: arg } = argv
    if (arg === '--docs-repo') {
      index += 1
      const { [index]: value } = argv
      docsRepo = value
    } else if (arg === '--bundle') {
      index += 1
      const { [index]: value } = argv
      bundleDir = value ?? bundleDir
    } else if (arg === '--dry-run') {
      dryRun = true
    } else if (arg !== undefined && arg !== '--') {
      throw new Error(`unknown argument: ${arg}`)
    }
  }

  if (docsRepo === undefined) {
    throw new Error('--docs-repo <path to contentful-docs checkout> is required')
  }
  return { docsRepo: path.resolve(rootDir, docsRepo), bundleDir, dryRun }
}

/**
 * Replaces the `- section: Optimization SDK` block in place.
 *
 * The owned span ends at the first nonblank line indented no deeper than the section itself,
 * whatever that line is. Terminating only on a sibling `- ` list item would be enough for the
 * navigation layout that happens to be checked in today, but a comment banner at the section's
 * indentation, or a trailing top-level key such as `tabs:`, would then be swallowed into the
 * replaced range and silently deleted.
 */
function spliceNavSection(existing: string, navBlock: string): string {
  const lines = existing.split('\n')
  const start = lines.findIndex(
    (line) => /^\s*-\s+section:\s*(.+?)\s*$/u.exec(line)?.[1] === NAV_SECTION_TITLE,
  )
  if (start === -1) {
    throw new Error(`${NAV_SUBPATH}: could not find "- section: ${NAV_SECTION_TITLE}"`)
  }

  const { [start]: rawStart } = lines
  const startLine = rawStart ?? ''
  const indent = startLine.length - startLine.trimStart().length
  let { length: end } = lines
  for (let index = start + 1; index < lines.length; index += 1) {
    const { [index]: raw } = lines
    const line = raw ?? ''
    if (line.trim() === '') {
      continue
    }
    const lineIndent = line.length - line.trimStart().length
    if (lineIndent <= indent) {
      end = index
      break
    }
  }

  return [
    ...lines.slice(0, start),
    ...navBlock.replace(/\n$/u, '').split('\n'),
    ...lines.slice(end),
  ].join('\n')
}

/**
 * Maintains the generated redirect span inside `redirects:`. Hand-authored redirects outside the
 * markers are preserved; the generated span is replaced wholesale.
 */
function spliceRedirects(existing: string, redirects: string): string {
  const body = redirects.trim() === '' ? [] : redirects.replace(/\n$/u, '').split('\n')
  const block = body.length === 0 ? [] : [REDIRECT_BEGIN, ...body, REDIRECT_END]

  const lines = existing.split('\n')
  const begin = lines.indexOf(REDIRECT_BEGIN)
  const finish = lines.indexOf(REDIRECT_END)
  if (begin !== -1 && finish !== -1 && finish > begin) {
    return [...lines.slice(0, begin), ...block, ...lines.slice(finish + 1)].join('\n')
  }

  if (block.length === 0) {
    return existing
  }

  const redirectsKey = lines.findIndex((line) => /^redirects:\s*$/u.test(line))
  if (redirectsKey === -1) {
    throw new Error(`${DOCS_CONFIG_SUBPATH}: could not find a top-level "redirects:" key`)
  }
  return [...lines.slice(0, redirectsKey + 1), ...block, ...lines.slice(redirectsKey + 1)].join(
    '\n',
  )
}

function main(): void {
  const options = parseArgs(process.argv.slice(2))
  const bundle = path.resolve(rootDir, options.bundleDir)
  if (!existsSync(path.join(bundle, 'pages'))) {
    throw new Error(`${options.bundleDir}: no bundle found. Run \`pnpm docs:fern\` first.`)
  }

  const pagesDir = path.join(options.docsRepo, PAGES_SUBPATH)
  const navPath = path.join(options.docsRepo, NAV_SUBPATH)
  const configPath = path.join(options.docsRepo, DOCS_CONFIG_SUBPATH)
  for (const required of [pagesDir, navPath, configPath]) {
    if (!existsSync(required)) {
      throw new Error(`${required} not found — is --docs-repo a contentful-docs checkout?`)
    }
  }

  const generated = readdirSync(path.join(bundle, 'pages')).filter((name) => name.endsWith('.mdx'))
  const existing = readdirSync(pagesDir).filter((name) => name.endsWith('.mdx'))
  // A page dropped from this repo must be removed there too, or `fern check` fails on a dangling
  // nav entry. Writer-owned pages are never touched.
  const removals = existing.filter(
    (name) => !WRITER_OWNED_PAGES.has(name) && !generated.includes(name),
  )

  const nav = spliceNavSection(
    readFileSync(navPath, 'utf8'),
    readFileSync(path.join(bundle, 'nav-block.yaml'), 'utf8'),
  )
  const config = spliceRedirects(
    readFileSync(configPath, 'utf8'),
    readFileSync(path.join(bundle, 'redirects.yaml'), 'utf8'),
  )

  if (options.dryRun) {
    process.stdout.write(
      `dry run: would write ${generated.length} page(s), remove ${removals.length}, and update ${NAV_SUBPATH} + ${DOCS_CONFIG_SUBPATH}\n`,
    )
    for (const name of removals) {
      process.stdout.write(`  remove ${name}\n`)
    }
    return
  }

  mkdirSync(pagesDir, { recursive: true })
  for (const name of generated) {
    writeFileSync(path.join(pagesDir, name), readFileSync(path.join(bundle, 'pages', name), 'utf8'))
  }
  for (const name of removals) {
    rmSync(path.join(pagesDir, name))
  }
  writeFileSync(navPath, nav)
  writeFileSync(configPath, config)

  process.stdout.write(
    `✓ Applied ${generated.length} page(s) to ${path.relative(rootDir, options.docsRepo)} (${removals.length} removed); ${NAV_SUBPATH} and ${DOCS_CONFIG_SUBPATH} updated.\n`,
  )
}

main()
