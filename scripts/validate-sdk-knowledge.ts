/* eslint-disable no-console -- This CLI prints a machine-readable validation report. */

/**
 * Validates the internal SDK knowledge base under documentation/internal/sdk-knowledge/.
 *
 * Enforces the source-pointer grammar documented in that directory's README.md so the base stays a
 * store of facts grounded in packages source, not claims grounded in other docs. It checks grammar
 * (pointers parse), resolution (symbols resolve against real TypeScript source via the compiler
 * API — symbol-anchored, no drift-prone line numbers), coverage (no pointerless facts), and
 * template conformance (per-SDK files match _template.md). Usage: tsx scripts/validate-sdk-knowledge.ts
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type Heading,
  headingsOf,
  isListItem,
  isPlaceholderCell,
  isTableDivider,
  parseTableRow,
} from './sdk-knowledge/markdown'
import { collectDeclaredSymbols } from './sdk-knowledge/source-symbols'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const knowledgeDir = path.join(rootDir, 'documentation/internal/sdk-knowledge')
const packagesDir = path.join(rootDir, 'packages')
const implementationsDir = path.join(rootDir, 'implementations')
const conceptsDir = path.join(rootDir, 'documentation/concepts')
const templatePath = path.join(knowledgeDir, '_template.md')

/** Files under the knowledge dir that document the format rather than record facts. Not graded. */
const META_FILES = new Set(['README.md', '_template.md'])
/** Directories under the knowledge dir holding shared, non-per-SDK material. */
const SHARED_DIRS = new Set(['shared'])

const HEADING_LEVEL_SECTION = 2
/** How many continuation lines below a list item may carry that item's pointer. */
const CONTINUATION_LOOKAHEAD = 3
const SUMMARY_TRUNCATE = 80
const LABEL_LEADIN_MAX = 40
/** A `<sdk>#<relpath>#<symbol>` token has this many `#`-separated parts (symbol optional). */
const TOKEN_PARTS_WITH_SYMBOL = 3

interface Problem {
  file: string
  line: number
  message: string
}

interface Pointer {
  line: number
  tokens: string[]
}

const problems: Problem[] = []
const sdkSrcRoots = discoverSdkSrcRoots()
const symbolCache = new Map<string, Set<string>>()

for (const file of listMarkdownFiles(knowledgeDir)) {
  validateFile(file)
}

report()

// --- per-file validation ---------------------------------------------------------------------

function validateFile(absPath: string): void {
  // README.md and _template.md are meta files: they hold placeholder `source:` guidance and
  // illustrative examples, not real facts. Exempt them so the format's own docs are not graded.
  if (META_FILES.has(path.basename(absPath))) {
    return
  }

  const relPath = path.relative(rootDir, absPath)
  const lines = readFileSync(absPath, 'utf8').split('\n')

  // Grammar + resolution apply to every fact file: any `source:` pointer must be valid.
  for (const pointer of extractPointers(lines)) {
    for (const token of pointer.tokens) {
      checkToken(token, relPath, pointer.line)
    }
  }

  // Coverage and template conformance apply only to per-SDK files, whose _template.md shape makes
  // "every bullet/row is a sourced fact" a firm rule. shared/ files mix normative prose with facts.
  if (isPerSdkFile(absPath)) {
    checkPointerCoverage(lines, relPath)
    checkTemplateConformance(lines, relPath)
  }
}

// --- pointer extraction ----------------------------------------------------------------------

/**
 * Pulls source pointers out of a fact file. Two carriers, per the grammar:
 *   - a prose line `source: <pointers>` (the pointer list runs to end of line)
 *   - a table row whose `source` column holds `<pointers>` (headed by a `| … | source |` row)
 */
function extractPointers(lines: string[]): Pointer[] {
  const pointers: Pointer[] = []
  let sourceColumnIndex: number | undefined = undefined

  lines.forEach((rawLine, index) => {
    const line = rawLine.trimEnd()
    const lineNumber = index + 1
    const columns = parseTableRow(line)

    if (columns !== undefined) {
      sourceColumnIndex = handleTableRow(columns, sourceColumnIndex, lineNumber, pointers)
      return
    }

    // A blank or non-table line ends the current table's column mapping.
    if (line === '' || !line.includes('|')) {
      sourceColumnIndex = undefined
    }

    const prosePointer = matchProseSource(line)
    if (prosePointer !== undefined) {
      pointers.push({ line: lineNumber, tokens: splitTokens(prosePointer) })
    }
  })

  return pointers
}

/** Updates the tracked source-column index and records a row's pointers. Returns the new index. */
function handleTableRow(
  columns: string[],
  sourceColumnIndex: number | undefined,
  lineNumber: number,
  pointers: Pointer[],
): number | undefined {
  const headerIndex = columns.findIndex((cell) => cell.toLowerCase() === 'source')
  if (headerIndex !== -1) {
    return headerIndex
  }
  if (isTableDivider(columns) || sourceColumnIndex === undefined) {
    return sourceColumnIndex
  }

  const { [sourceColumnIndex]: cell } = columns
  if (cell !== undefined && cell !== '' && !isPlaceholderCell(cell)) {
    pointers.push({ line: lineNumber, tokens: splitTokens(cell) })
  }
  return sourceColumnIndex
}

/** Returns the pointer text of a `source: …` prose line, or undefined if the line is not one. */
function matchProseSource(line: string): string | undefined {
  const match = /(?:^|\s)source:\s*(.+)$/u.exec(line)
  if (match?.[1] === undefined) {
    return undefined
  }
  // Strip a trailing sentence period that terminates the fact, not a pointer.
  return match[1].trim().replace(/\.$/u, '')
}

function splitTokens(pointerText: string): string[] {
  return pointerText
    .split(';')
    .map((token) => token.trim().replace(/^`|`$/gu, '').trim())
    .filter((token) => token !== '')
}

// --- token checking --------------------------------------------------------------------------

function checkToken(token: string, file: string, line: number): void {
  const prefixedCheck = checkPrefixedToken(token, file, line)
  if (prefixedCheck) {
    return
  }
  checkSourceToken(token, file, line)
}

/** Handles the `extern:` / `concept:` / `kb:` / `impl:` forms. Returns true if one matched. */
function checkPrefixedToken(token: string, file: string, line: number): boolean {
  if (token.startsWith('extern:')) {
    if (token.slice('extern:'.length).trim() === '') {
      addProblem(file, line, `extern: pointer has no text: "${token}"`)
    }
    return true
  }

  if (token.startsWith('concept:')) {
    const slug = token.slice('concept:'.length).trim()
    checkFile(path.join(conceptsDir, `${slug}.md`), `concept:${slug}`, file, line)
    return true
  }

  if (token.startsWith('kb:')) {
    const relPath = token.slice('kb:'.length).trim()
    checkFile(path.join(knowledgeDir, relPath), `kb:${relPath}`, file, line)
    return true
  }

  if (token.startsWith('impl:')) {
    checkImplToken(token, file, line)
    return true
  }

  return false
}

function checkImplToken(token: string, file: string, line: number): void {
  const [name, relPath] = splitOnce(token.slice('impl:'.length), '#')
  if (name === undefined || relPath === undefined) {
    addProblem(file, line, `impl: pointer must be impl:<name>#<relpath>: "${token}"`)
    return
  }
  checkFile(path.join(implementationsDir, name, relPath), token, file, line)
}

/** Handles the `<sdk>#<relpath>[#<symbol>]` form. */
function checkSourceToken(token: string, file: string, line: number): void {
  const parts = token.split('#')
  const [sdk, relPath, symbol] = parts
  const hasValidArity = parts.length === 2 || parts.length === TOKEN_PARTS_WITH_SYMBOL

  if (!hasValidArity || sdk === undefined || relPath === undefined) {
    addProblem(
      file,
      line,
      `unrecognized source pointer "${token}" — expected <sdk>#<relpath>[#<symbol>], ` +
        `impl:<name>#<relpath>, concept:<slug>, kb:<relpath>, or extern:<text>`,
    )
    return
  }

  const srcRoot = sdkSrcRoots.get(sdk)
  if (srcRoot === undefined) {
    const known = [...sdkSrcRoots.keys()].sort().join(', ')
    addProblem(file, line, `unknown SDK key "${sdk}" in "${token}" — known keys: ${known}`)
    return
  }

  const filePath = path.join(srcRoot, relPath)
  if (!fileExists(filePath)) {
    addProblem(file, line, `${token} → no such source file (${rel(filePath)})`)
    return
  }

  if (symbol !== undefined && !fileDeclaresSymbol(filePath, symbol)) {
    addProblem(file, line, `${token} → file exists but declares no symbol "${symbol}"`)
  }
}

function checkFile(candidate: string, label: string, file: string, line: number): void {
  if (!fileExists(candidate)) {
    addProblem(file, line, `${label} → no such file (${rel(candidate)})`)
  }
}

// --- coverage --------------------------------------------------------------------------------

/**
 * Flags a list/numbered fact line that states an SDK fact (references a concrete symbol in inline
 * code) but carries no pointer — neither on the line nor on an immediate continuation line.
 */
function checkPointerCoverage(lines: string[], file: string): void {
  lines.forEach((rawLine, index) => {
    const line = rawLine.trim()
    if (!isListItem(line) || !line.endsWith('.') || line.endsWith('None.')) {
      return
    }
    if (line.includes('source:') || itemHasPointerNearby(lines, index)) {
      return
    }
    if (looksLikeFact(line)) {
      addProblem(file, index + 1, `fact has no source: pointer — "${truncate(line)}"`)
    }
  })
}

function itemHasPointerNearby(lines: string[], index: number): boolean {
  for (let offset = 1; offset <= CONTINUATION_LOOKAHEAD; offset += 1) {
    const { [index + offset]: next } = lines
    if (next === undefined) {
      return false
    }
    const trimmed = next.trim()
    if (trimmed === '' || isListItem(trimmed)) {
      return false
    }
    if (trimmed.includes('source:')) {
      return true
    }
  }
  return false
}

/**
 * A heuristic for "this list item is an SDK fact that must be sourced" vs prose guidance. Facts
 * reference a concrete symbol/config key/path/identifier as inline code. A bullet that only
 * delegates to another doc ("Model: see ../shared/concepts.md#…") is a cross-reference, not a fact.
 */
function looksLikeFact(line: string): boolean {
  if (!/`[^`]+`/u.test(line)) {
    return false
  }
  return !isCrossReference(line)
}

function isCrossReference(line: string): boolean {
  if (!/\bsee\b/iu.test(line)) {
    return false
  }
  const body = line
    .replace(/^[-*]\s+|^\d+\.\s+/u, '')
    .replace(new RegExp(`^[^:]{0,${LABEL_LEADIN_MAX}}:\\s*`, 'u'), '')
    .replace(/^see\s+/iu, '')
  const withoutLinks = body.replace(/\[[^\]]*\]\([^)]*\)/gu, '').replace(/`[^`]*`/gu, '')
  return withoutLinks.replace(/[\s.,;]/gu, '') === ''
}

// --- template conformance --------------------------------------------------------------------

function checkTemplateConformance(lines: string[], file: string): void {
  const expected = sectionHeadings(readFileSync(templatePath, 'utf8').split('\n'))
  const fileHeadings = sectionLevel(headingsOf(lines))
  const actual = fileHeadings.map((heading) => heading.text)

  if (!arraysEqual(expected, actual)) {
    addProblem(
      file,
      fileHeadings[0]?.line ?? 1,
      `## headings must match _template.md exactly and in order.\n` +
        `    expected: ${expected.join(' | ')}\n` +
        `    actual:   ${actual.join(' | ')}`,
    )
  }
}

function sectionHeadings(lines: string[]): string[] {
  return sectionLevel(headingsOf(lines)).map((heading) => heading.text)
}

function sectionLevel(headings: Heading[]): Heading[] {
  return headings.filter((heading) => heading.level === HEADING_LEVEL_SECTION)
}

// --- source resolution (TypeScript compiler API) ---------------------------------------------

/** Resolves and caches the set of symbols a source file declares (see source-symbols.ts). */
function fileDeclaresSymbol(filePath: string, symbol: string): boolean {
  let symbols = symbolCache.get(filePath)
  if (symbols === undefined) {
    symbols = collectDeclaredSymbols(filePath)
    symbolCache.set(filePath, symbols)
  }
  return symbols.has(symbol)
}

// --- workspace discovery ---------------------------------------------------------------------

/** Maps each package directory basename (the `<sdk>` grammar key) to its `src/` root. */
function discoverSdkSrcRoots(): Map<string, string> {
  const roots = new Map<string, string>()

  for (const manifestPath of findPackageManifests(packagesDir)) {
    const packageDir = path.dirname(manifestPath)
    const srcDir = path.join(packageDir, 'src')
    if (!directoryExists(srcDir)) {
      continue
    }
    const key = path.basename(packageDir)
    const existing = roots.get(key)
    if (existing !== undefined && existing !== srcDir) {
      throw new Error(
        `Ambiguous SDK key "${key}": ${rel(existing)} and ${rel(srcDir)}. ` +
          `Package directory basenames must be unique to serve as source-pointer keys.`,
      )
    }
    roots.set(key, srcDir)
  }

  if (roots.size === 0) {
    throw new Error(`No package src roots discovered under ${rel(packagesDir)}.`)
  }

  return roots
}

function findPackageManifests(dir: string): string[] {
  const manifests: string[] = []
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue
      }
      const entryPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        walk(entryPath)
      } else if (entry.name === 'package.json') {
        manifests.push(entryPath)
      }
    }
  }
  walk(dir)
  return manifests
}

// --- file helpers ----------------------------------------------------------------------------

function listMarkdownFiles(dir: string): string[] {
  const files: string[] = []
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        walk(entryPath)
      } else if (entry.name.endsWith('.md')) {
        files.push(entryPath)
      }
    }
  }
  walk(dir)
  return files.sort((left, right) => left.localeCompare(right))
}

function isPerSdkFile(absPath: string): boolean {
  const relInside = path.relative(knowledgeDir, absPath)
  const [firstSegment] = relInside.split(path.sep)
  if (firstSegment !== undefined && SHARED_DIRS.has(firstSegment)) {
    return false
  }
  return !META_FILES.has(path.basename(absPath))
}

function fileExists(candidate: string): boolean {
  try {
    return statSync(candidate).isFile()
  } catch {
    return false
  }
}

function directoryExists(candidate: string): boolean {
  try {
    return statSync(candidate).isDirectory()
  } catch {
    return false
  }
}

function splitOnce(value: string, separator: string): [string | undefined, string | undefined] {
  const index = value.indexOf(separator)
  if (index === -1) {
    return [value === '' ? undefined : value, undefined]
  }
  return [value.slice(0, index), value.slice(index + separator.length)]
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function rel(absPath: string): string {
  return path.relative(rootDir, absPath)
}

function truncate(value: string, max = SUMMARY_TRUNCATE): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

// --- reporting -------------------------------------------------------------------------------

function addProblem(file: string, line: number, message: string): void {
  problems.push({ file, line, message })
}

function report(): void {
  if (problems.length === 0) {
    console.log('✓ SDK knowledge base: all source pointers resolve and templates conform.')
    return
  }

  problems.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line)

  console.error(`✗ SDK knowledge base: ${problems.length} problem(s) found.\n`)
  for (const problem of problems) {
    console.error(`  ${problem.file}:${problem.line}  ${problem.message}`)
  }
  console.error(
    `\nSee documentation/internal/sdk-knowledge/README.md#source-pointer-grammar for the grammar.`,
  )
  process.exit(1)
}
