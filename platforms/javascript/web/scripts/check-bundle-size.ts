import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

interface BundleSizeResult {
  file: string
  rawBytes: number
  gzipBytes: number
  budgetBytes: number
}

interface BundleSizeFailure {
  file: string
  gzipBytes: number
  budgetBytes: number
  overBytes: number
}

const distDir = resolve(process.cwd(), 'dist')
const reportOnly = process.argv.includes('--report-only')

/* eslint-disable @typescript-eslint/no-magic-numbers -- bundle budgets are explicit byte thresholds. */
const gzipBudgets = new Map<string, number>([
  ['index.mjs', 7200],
  ['index.cjs', 8100],
  ['contentful-optimization-web.umd.js', 31200],
])
/* eslint-enable @typescript-eslint/no-magic-numbers -- bundle budgets are explicit byte thresholds. */
const results: BundleSizeResult[] = []
const failures: BundleSizeFailure[] = []

for (const [file, budgetBytes] of gzipBudgets) {
  const filePath = resolve(distDir, file)
  const contents = readFileSync(filePath)
  const { byteLength: gzipBytes } = gzipSync(contents, { level: 9 })

  results.push({
    file,
    rawBytes: contents.byteLength,
    gzipBytes,
    budgetBytes,
  })

  if (!reportOnly && gzipBytes > budgetBytes) {
    failures.push({
      file,
      gzipBytes,
      budgetBytes,
      overBytes: gzipBytes - budgetBytes,
    })
  }
}

for (const result of results) {
  const { budgetBytes, file, gzipBytes, rawBytes } = result
  const budgetText = reportOnly ? 'n/a' : String(budgetBytes)
  // eslint-disable-next-line no-console -- this script reports bundle stats to CI logs.
  console.log(`${file}: raw=${rawBytes} gzip=${gzipBytes} budget=${budgetText}`)
}

if (failures.length > 0) {
  // eslint-disable-next-line no-console -- this script reports failures to CI logs.
  console.error('Bundle size budget exceeded:')
  for (const failure of failures) {
    // eslint-disable-next-line no-console -- this script reports failures to CI logs.
    console.error(
      `- ${failure.file}: gzip=${failure.gzipBytes} budget=${failure.budgetBytes} (+${failure.overBytes})`,
    )
  }
  process.exit(1)
}
