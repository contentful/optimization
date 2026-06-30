import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, relative, resolve, sep } from 'node:path'
import { gzipSync } from 'node:zlib'
import { isRecord } from './typeGuards'

export interface BundleSizeResult {
  files: string[]
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

const LOCAL_IMPORT_PATTERN =
  /\bimport\s*(?:[^'"]*?from\s*)?['"]([^'"]+)['"]|\bexport\s*[^'"]*?from\s*['"]([^'"]+)['"]|\brequire\(\s*['"]([^'"]+)['"]\s*\)/g
const PARSEABLE_EXTENSIONS = new Set(['.cjs', '.js', '.mjs'])
const RESOLVABLE_EXTENSIONS = ['', '.mjs', '.cjs', '.js', '.css', '.json']

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

function isWithinDirectory(filePath: string, directory: string): boolean {
  const relativePath = relative(directory, filePath)
  return relativePath !== '' && !relativePath.startsWith('..') && !relativePath.includes(`..${sep}`)
}

function resolveLocalImport(
  fromFilePath: string,
  specifier: string,
  distDir: string,
): string | undefined {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
    return undefined
  }

  const resolvedPath = resolve(dirname(fromFilePath), specifier)
  if (!isWithinDirectory(resolvedPath, distDir)) {
    return undefined
  }

  for (const extension of RESOLVABLE_EXTENSIONS) {
    const candidate = `${resolvedPath}${extension}`
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return undefined
}

function readLocalImportSpecifiers(contents: string): string[] {
  const specifiers: string[] = []

  for (const match of contents.matchAll(LOCAL_IMPORT_PATTERN)) {
    const specifier = match.slice(1).find(Boolean)
    if (specifier) {
      specifiers.push(specifier)
    }
  }

  return specifiers
}

function collectReachableFiles(entryFilePath: string, distDir: string): string[] {
  const reachableFiles: string[] = []
  const visitedFiles = new Set<string>()

  function visit(filePath: string): void {
    if (visitedFiles.has(filePath)) {
      return
    }

    visitedFiles.add(filePath)
    reachableFiles.push(filePath)

    if (!PARSEABLE_EXTENSIONS.has(extname(filePath))) {
      return
    }

    const contents = readFileSync(filePath, 'utf8')

    for (const specifier of readLocalImportSpecifiers(contents)) {
      const importedFilePath = resolveLocalImport(filePath, specifier, distDir)

      if (importedFilePath !== undefined) {
        visit(importedFilePath)
      }
    }
  }

  visit(entryFilePath)

  return reachableFiles
}

function measureFiles(files: string[]): {
  rawBytes: number
  gzipBytes: number
} {
  return files.reduce(
    (accumulator, file) => {
      const contents = readFileSync(file)

      return {
        gzipBytes: accumulator.gzipBytes + gzipSync(contents, { level: 9 }).byteLength,
        rawBytes: accumulator.rawBytes + contents.byteLength,
      }
    },
    { gzipBytes: 0, rawBytes: 0 },
  )
}

/**
 * Measures configured bundle entries in a package's `dist/` directory and optionally enforces
 * configured gzip budgets from `package.json`. JavaScript entries include local static chunks
 * reachable from the configured entry file so ESM chunking cannot hide entrypoint cost.
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
    const reachableFiles = collectReachableFiles(filePath, distDir)
    const { gzipBytes, rawBytes } = measureFiles(reachableFiles)

    results.push({
      files: reachableFiles.map((reachableFile) => relative(distDir, reachableFile)),
      file,
      rawBytes,
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
