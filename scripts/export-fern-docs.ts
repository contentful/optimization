/**
 * Builds the Fern-ready documentation bundle from `documentation/`.
 *
 * Layer 1 of the sync: a pure local transform with no network access and no credentials, so it can be
 * iterated on and diffed against the published site without touching anything remote.
 * `scripts/apply-fern-docs.ts` is what copies a bundle into a `contentful-docs` checkout.
 *
 * Usage:
 *   pnpm docs:fern                          build into fern-bundle/
 *   pnpm docs:fern -- --ref <git-ref>       pin repo-relative links to a release tag
 *   pnpm docs:fern -- --update-lock         accept slug changes and record their redirects
 */

import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { buildBundle, LOCK_PATH, reportFatal, reportProblems } from './fern/build'
import { rootDir } from './fern/docs'

/**
 * The bundle directory is a fixed, gitignored path this script owns, not a caller-supplied one. It
 * is cleared before each build, and an arbitrary path reaching a recursive delete is the kind of
 * mistake that costs a working tree. Nothing consumes a configurable location: `docs:fern:apply`
 * reads from here, and the sync workflow builds and applies in one checkout. To compare two builds,
 * copy this directory aside between runs.
 */
const BUNDLE_DIR = 'fern-bundle'
/** Everything the build writes, so cleanup removes only what a previous build put here. */
const BUNDLE_MEMBERS = ['nav-block.yaml', 'redirects.yaml', 'manifest.json'] as const
const DEFAULT_REF = 'main'
/** Each redirect renders as a `source` line plus a `destination` line. */
const REDIRECT_LINES = 2

interface Options {
  ref: string
  updateLock: boolean
}

function parseArgs(argv: readonly string[]): Options {
  let ref = DEFAULT_REF
  let updateLock = false

  for (let index = 0; index < argv.length; index += 1) {
    const { [index]: arg } = argv
    if (arg === '--ref') {
      index += 1
      ref = argv[index] ?? DEFAULT_REF
    } else if (arg === '--update-lock') {
      updateLock = true
    } else if (arg !== undefined && arg !== '--') {
      // A bare `--` arrives when invoked as `pnpm docs:fern -- <args>`.
      throw new Error(`unknown argument: ${arg}`)
    }
  }

  return { ref, updateLock }
}

function main(): void {
  const options = parseArgs(process.argv.slice(2))
  const result = buildBundle({ ref: options.ref, acceptSlugChanges: options.updateLock })

  if (result.problems.length > 0) {
    reportProblems(result.problems)
    process.exitCode = 1
    return
  }

  if (options.updateLock) {
    const slugs = Object.fromEntries(
      Object.entries(result.lock.slugs).sort(([left], [right]) => left.localeCompare(right)),
    )
    writeFileSync(
      LOCK_PATH,
      `${JSON.stringify({ slugs, redirects: result.lock.redirects }, null, 2)}\n`,
    )
  }

  const outDir = path.join(rootDir, BUNDLE_DIR)
  const pagesDir = path.join(outDir, 'pages')
  mkdirSync(pagesDir, { recursive: true })

  // Remove the previous build member by member. A stale page for a document that no longer
  // publishes has to go, but anything else parked in this directory is left alone.
  for (const name of readdirSync(pagesDir)) {
    if (name.endsWith('.mdx')) {
      rmSync(path.join(pagesDir, name))
    }
  }
  for (const name of BUNDLE_MEMBERS) {
    rmSync(path.join(outDir, name), { force: true })
  }

  for (const page of result.pages) {
    writeFileSync(path.join(outDir, 'pages', `${page.slug}.mdx`), page.mdx)
  }

  writeFileSync(path.join(outDir, 'nav-block.yaml'), `${result.navBlock.join('\n')}\n`)
  writeFileSync(
    path.join(outDir, 'redirects.yaml'),
    result.redirects.length === 0 ? '' : `${result.redirects.join('\n')}\n`,
  )
  writeFileSync(
    path.join(outDir, 'manifest.json'),
    `${JSON.stringify(
      {
        ref: options.ref,
        pages: result.docs.map((doc) => ({
          source: doc.relPath,
          slug: doc.fern.slug,
          section: doc.fern.section,
          title: doc.fern.title,
          ...(doc.fern.navTitle === undefined ? {} : { navTitle: doc.fern.navTitle }),
        })),
      },
      null,
      2,
    )}\n`,
  )

  const redirectCount = result.redirects.length / REDIRECT_LINES
  process.stdout.write(
    `✓ Fern bundle: ${result.pages.length} page(s), ${redirectCount} redirect(s), ref ${options.ref} -> ${path.relative(rootDir, outDir)}/\n`,
  )
}

try {
  main()
} catch (error) {
  reportFatal(error)
}
