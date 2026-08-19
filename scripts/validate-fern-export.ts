/**
 * Validates that `documentation/` can still produce a correct Fern bundle, without writing anything.
 *
 * This is the gate that makes the link rot the manual process accumulated impossible to reintroduce:
 * every cross-document link must resolve to a published page, and every `#fragment` must match a real
 * heading on that page. It also enforces the MDX safety rule that catches leaked markup, and refuses
 * an unrecorded slug change so a live URL can never move silently.
 *
 * Usage: pnpm fern:check [-- --ref <git-ref>]
 */

import { buildBundle, reportFatal, reportProblems } from './fern/build'

const DEFAULT_REF = 'main'

function parseRef(argv: readonly string[]): string {
  const index = argv.indexOf('--ref')
  if (index === -1) {
    return DEFAULT_REF
  }
  return argv[index + 1] ?? DEFAULT_REF
}

function main(): void {
  const ref = parseRef(process.argv.slice(2))
  const result = buildBundle({ ref, acceptSlugChanges: false })

  if (result.problems.length > 0) {
    reportProblems(result.problems)
    process.exitCode = 1
    return
  }

  const anchors = result.docs.reduce((total, doc) => total + doc.anchors.size, 0)
  process.stdout.write(
    `✓ Fern export: ${result.docs.length} page(s) across ${new Set(result.docs.map((doc) => doc.fern.section)).size} section(s), ${anchors} anchor(s) resolvable, slugs match the lock, MDX safe.\n`,
  )
}

try {
  main()
} catch (error) {
  reportFatal(error)
}
