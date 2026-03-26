import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

export interface BundleSizeResult {
  file: string
  rawBytes: number
  gzipBytes: number
  budgetBytes: number
}

export interface BundleSizeFailure {
  file: string
  gzipBytes: number
  budgetBytes: number
  overBytes: number
}

export interface CheckBundleSizeOptions {
  packageDir?: string
  reportOnly?: boolean
}

interface BuildToolsBundleSizeConfig {
  gzipBudgets: Record<string, number>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasPositiveNumberValues(value: unknown): value is Record<string, number> {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (budget): budget is number =>
        typeof budget === 'number' && Number.isFinite(budget) && budget > 0,
    )
  )
}

function readBundleSizeConfig(value: unknown): BuildToolsBundleSizeConfig | undefined {
  if (!isRecord(value)) return undefined

  const { bundleSize } = value

  if (!isRecord(bundleSize)) return undefined

  const { gzipBudgets } = bundleSize

  if (!hasPositiveNumberValues(gzipBudgets)) return undefined

  return { gzipBudgets }
}

function readGzipBudgets(packageDir: string): Map<string, number> {
  const packageJsonPath = resolve(packageDir, 'package.json')
  const packageJsonContent: unknown = JSON.parse(readFileSync(packageJsonPath, 'utf8'))

  if (!isRecord(packageJsonContent)) {
    throw new Error(
      `Missing buildTools.bundleSize.gzipBudgets in ${packageJsonPath}. Configure per-file gzip budgets before running bundle-size checks.`,
    )
  }

  const bundleSizeConfig = readBundleSizeConfig(packageJsonContent.buildTools)

  if (!bundleSizeConfig) {
    throw new Error(
      `Missing buildTools.bundleSize.gzipBudgets in ${packageJsonPath}. Configure per-file gzip budgets before running bundle-size checks.`,
    )
  }

  return new Map(Object.entries(bundleSizeConfig.gzipBudgets))
}

/**
 * Measures configured bundle files in a package's `dist/` directory and optionally enforces
 * configured gzip budgets from `package.json`.
 *
 * @param options - Package directory and reporting mode.
 * @returns Measured results and any budget failures.
 *
 * @public
 */
export function checkBundleSize(options: CheckBundleSizeOptions = {}): {
  results: BundleSizeResult[]
  failures: BundleSizeFailure[]
} {
  const { packageDir = process.cwd(), reportOnly = false } = options
  const distDir = resolve(packageDir, 'dist')
  const gzipBudgets = readGzipBudgets(packageDir)
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

  return { results, failures }
}
