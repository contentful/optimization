/**
 * The shared build step behind `pnpm docs:fern` and `pnpm fern:check`.
 *
 * Both entry points run the identical pipeline; only what they do with the result differs. The
 * exporter writes the bundle, the validator reports. Keeping one implementation is what makes
 * "CI passed" and "the bundle I built locally" mean the same thing.
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { emptyLock, reconcileLock, renderNavBlock, renderRedirects, type SlugLock } from './bundle'
import { bySourceName, DocError, loadPublishedDocs, rootDir, type PublishedDoc } from './docs'
import { transformDoc } from './transform'

export const LOCK_PATH = path.join(rootDir, 'documentation/fern-slugs.lock.json')

export interface Problem {
  file: string
  line: number
  message: string
}

export interface BuildOptions {
  /** Git ref that repo-relative links are pinned to. */
  ref: string
  /** When false, an unrecorded slug change is reported as a problem instead of being accepted. */
  acceptSlugChanges: boolean
}

export interface BuildResult {
  docs: PublishedDoc[]
  pages: Array<{ slug: string; mdx: string }>
  navBlock: string[]
  redirects: string[]
  lock: SlugLock
  problems: Problem[]
}

export function readLock(): SlugLock {
  if (!existsSync(LOCK_PATH)) {
    return emptyLock()
  }
  const parsed: unknown = JSON.parse(readFileSync(LOCK_PATH, 'utf8'))
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${LOCK_PATH}: expected a JSON object`)
  }
  const { slugs, redirects } = parsed as Partial<SlugLock>
  return { slugs: slugs ?? {}, redirects: redirects ?? [] }
}

export function buildBundle(options: BuildOptions): BuildResult {
  const docs = loadPublishedDocs()
  const docsBySourceName = bySourceName(docs)
  const problems: Problem[] = []

  // A duplicate slug would silently overwrite one page with another.
  const slugOwners = new Map<string, string>()
  for (const doc of docs) {
    const owner = slugOwners.get(doc.fern.slug)
    if (owner !== undefined) {
      problems.push({
        file: doc.relPath,
        line: 1,
        message: `duplicate fern.slug "${doc.fern.slug}", already used by ${owner}`,
      })
    }
    slugOwners.set(doc.fern.slug, doc.relPath)
  }

  const pages = docs.map((doc) => {
    const { mdx, problems: found } = transformDoc(doc, { ref: options.ref, docsBySourceName })
    for (const problem of found) {
      problems.push({ file: doc.relPath, line: problem.line, message: problem.message })
    }
    return { slug: doc.fern.slug, mdx }
  })

  const lock = readLock()
  if (!options.acceptSlugChanges) {
    const { slugs } = lock
    for (const doc of docs) {
      const { [doc.relPath]: previous } = slugs
      if (previous !== undefined && previous !== doc.fern.slug) {
        problems.push({
          file: doc.relPath,
          line: 1,
          message: `fern.slug changed "${previous}" -> "${doc.fern.slug}"; rerun \`pnpm docs:fern -- --update-lock\` to record the redirect`,
        })
      }
    }
    // A document missing from the lock has never been published; that is expected for a new page.
  }

  const reconciled = reconcileLock(lock, docs)

  return {
    docs,
    pages,
    navBlock: renderNavBlock(docs),
    redirects: renderRedirects(reconciled),
    lock: reconciled,
    problems,
  }
}

/**
 * Reports a fatal frontmatter or discovery error in the same form as a validation problem, so a
 * malformed document reads like every other failure instead of a stack trace.
 */
export function reportFatal(error: unknown): void {
  if (error instanceof DocError) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
    return
  }
  if (error instanceof Error) {
    throw error
  }
  throw new Error(String(error))
}

/** Prints problems in the `file:line: message` form the repo's other validators use. */
export function reportProblems(problems: readonly Problem[]): void {
  ;[...problems]
    .sort((left, right) =>
      left.file === right.file ? left.line - right.line : left.file.localeCompare(right.file),
    )
    .forEach((problem) => {
      process.stderr.write(`${problem.file}:${problem.line}: ${problem.message}\n`)
    })
}
