import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, relative, resolve } from 'node:path'

const DEFAULT_PATHS = ['./src', './dist'] as const
const CHECKED_EXTENSIONS = new Set(['.cjs', '.cts', '.js', '.jsx', '.mjs', '.mts', '.ts', '.tsx'])
const CLIENT_DIRECTIVE_PATTERN = /(?:^|[\n;])\s*['"]use client['"]\s*;?/
const EXPORT_ALL_PATTERN = /\bexport\s*\*\s*(?:as\s+[$A-Z_a-z][$\w]*\s*)?from\b/

export interface CheckClientBoundaryExportsOptions {
  readonly cwd?: string
  readonly paths?: readonly string[]
}

export interface ClientBoundaryExportFailure {
  readonly file: string
}

export function checkClientBoundaryExports(
  options: CheckClientBoundaryExportsOptions = {},
): ClientBoundaryExportFailure[] {
  const cwd = resolve(options.cwd ?? process.cwd())
  const inputPaths = options.paths?.length ? options.paths : DEFAULT_PATHS
  const files = inputPaths.flatMap((inputPath) => collectFiles(resolve(cwd, inputPath)))

  return files
    .sort()
    .filter((filePath) => {
      const source = readFileSync(filePath, 'utf8')
      return CLIENT_DIRECTIVE_PATTERN.test(source) && EXPORT_ALL_PATTERN.test(source)
    })
    .map((filePath) => ({ file: toRelativePath(cwd, filePath) }))
}

function collectFiles(filePath: string): string[] {
  if (!existsSync(filePath)) return []

  const stats = statSync(filePath)

  if (stats.isDirectory()) {
    return readdirSync(filePath, { withFileTypes: true }).flatMap((entry) =>
      collectFiles(resolve(filePath, entry.name)),
    )
  }

  if (!stats.isFile()) return []
  if (isDeclarationFile(filePath)) return []
  if (!CHECKED_EXTENSIONS.has(extname(filePath))) return []

  return [filePath]
}

function isDeclarationFile(filePath: string): boolean {
  return filePath.endsWith('.d.ts') || filePath.endsWith('.d.mts') || filePath.endsWith('.d.cts')
}

function toRelativePath(cwd: string, filePath: string): string {
  return relative(cwd, filePath) || filePath
}
