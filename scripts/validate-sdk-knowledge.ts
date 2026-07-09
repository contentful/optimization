/* eslint-disable no-console -- This CLI prints a machine-readable validation report. */

/**
 * Validates the internal SDK knowledge base under documentation/internal/sdk-knowledge/.
 *
 * The knowledge base records verified SDK facts, each ending in a `source:` pointer. This script is
 * the machine that keeps those pointers honest: it enforces the pointer grammar documented in the
 * base's own README (`#source-pointer-grammar`), so the base stays a store of facts grounded in real
 * source rather than claims grounded in other docs. It is wired into CI (on any change to the base
 * OR to packages/**\/src) and into a Stop hook, so a source refactor that orphans a pointer fails on
 * the same change.
 *
 * ## The four checks
 *
 *   1. Grammar     — every `source:` pointer parses into a known token form. A free-text pointer
 *                    (the old "source: accepted App Router guide") is rejected: that is the whole
 *                    point, since a pointer at another doc is circular, not evidence.
 *   2. Resolution  — a `<sdk>#file#symbol` token resolves to a real file AND a symbol actually
 *                    declared in it, checked against the TypeScript source via the compiler API
 *                    (see source-symbols.ts). Pointers are SYMBOL-anchored, never line numbers,
 *                    because line ranges drift on every edit while a symbol name does not.
 *                    impl:/concept:/kb: tokens resolve to real files; extern: is trusted (out of repo).
 *   3. Coverage    — in a per-SDK file, a bullet that states an SDK fact (names a concrete symbol in
 *                    inline code) must carry a pointer; a pointerless fact is a claim, not knowledge.
 *   4. Template    — per-SDK files match _template.md heading-for-heading, in order, so every SDK is
 *                    documented against the same skeleton.
 *
 * ## How a pointer is found and checked
 *
 * Pointers ride on one of two carriers (extractPointers): a prose `source: …` line, or the `source`
 * column of a markdown table. Each carrier yields one or more `; `-separated tokens; each token is
 * classified and resolved by checkToken. Grammar + resolution + the "no wrapped pointer line" guard
 * apply to every fact file (per-SDK and shared/); coverage + template conformance apply only to
 * per-SDK files, because shared/ files intentionally mix normative prose with facts.
 *
 * ## Scope of files
 *
 *   - META_FILES (README.md, _template.md) — document the format and hold placeholder/illustrative
 *     pointers; exempt from all checks so the format's own docs are not graded as data.
 *   - shared/** — grammar + resolution only (mixed prose + facts).
 *   - everything else (per-SDK files) — all four checks.
 *
 * Failures accumulate into `problems` and are printed sorted by file:line; a non-empty set exits 1.
 *
 * Usage: tsx scripts/validate-sdk-knowledge.ts   (or `pnpm knowledge:check`)
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

/** Template conformance compares only `##` section headings (level 2); `#` title and `###` vary. */
const HEADING_LEVEL_SECTION = 2
/**
 * How many continuation lines below a list item may carry that item's pointer. A fact may wrap its
 * prose across a couple of lines and put `source:` on the last; we look this far ahead for it before
 * concluding the fact is pointerless.
 */
const CONTINUATION_LOOKAHEAD = 3
/** Max length of a fact excerpt echoed back in a problem message, so reports stay readable. */
const SUMMARY_TRUNCATE = 80
/** Max length of a `Label:` lead-in stripped when testing whether a bullet is a bare cross-reference. */
const LABEL_LEADIN_MAX = 40
/** A `<sdk>#<relpath>#<symbol>` token has this many `#`-separated parts (the symbol is optional). */
const TOKEN_PARTS_WITH_SYMBOL = 3

/** One validation failure, anchored to a file and line for a sorted, clickable report. */
interface Problem {
  file: string
  line: number
  message: string
}

/** The pointer tokens found on one carrier line (a `source:` prose line or a table row). */
interface Pointer {
  line: number
  tokens: string[]
}

// Module-level state, built once and shared across every file check:
//   problems    — accumulates failures; a non-empty set makes report() exit 1.
//   sdkSrcRoots — <sdk> grammar key → package src/ root, discovered from the workspace (not hardcoded).
//   symbolCache — per-file declared-symbol sets, so a file parsed once serves many pointers.
const problems: Problem[] = []
const sdkSrcRoots = discoverSdkSrcRoots()
const symbolCache = new Map<string, Set<string>>()

// Entry point: validate every markdown file in the base, then print the sorted report and exit.
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

  // A `source:` line must not wrap (its tokens run to end of line). Catch a continuation line that
  // is nothing but pointer tokens — those tokens would otherwise be parsed by no one and skip
  // validation entirely. Prose continuations ("The React Web guides…") have no such shape.
  checkDanglingPointerLines(lines, relPath)

  // Coverage, template conformance, and the KB→guide link apply only to per-SDK files: shared/ files
  // mix normative prose with facts and feed a family rather than a single guide.
  if (isPerSdkFile(absPath)) {
    checkPointerCoverage(lines, relPath)
    checkTemplateConformance(lines, relPath)
    checkFeedsGuides(lines, relPath)
  }
}

// --- pointer extraction ----------------------------------------------------------------------

/**
 * Pulls source pointers out of a fact file. Two carriers, per the grammar:
 *   - a prose line `source: <pointers>` (the pointer list runs to end of line)
 *   - a table row whose `source` column holds `<pointers>` (headed by a `| … | source |` row)
 *
 * Tables need per-row state: a `source` column can sit at any index, and different tables in the
 * same file can put it at different indices. `sourceColumnIndex` remembers where the current table's
 * `source` column is; it is set when a header row is seen and cleared when the table ends (a blank or
 * non-table line), so a bare `source` word in unrelated prose never gets treated as a column.
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

    // A blank or non-table line ends the current table, so its column mapping no longer applies.
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

/**
 * Processes one table row, threading the `source`-column index through the table's rows. Three cases:
 *   - Header row (has a `source` cell): remember that column index for the rows that follow.
 *   - Divider row (`| --- |`), or a body row before any header was seen: nothing to record.
 *   - Body row with a known source column: record that cell's pointers (unless it is an empty/`—`
 *     placeholder cell, which legitimately carries no pointer).
 * Returns the (possibly updated) source-column index for the next row.
 */
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

/**
 * Flags a line that is a wrapped continuation of a `source:` line — a line consisting only of
 * grammar tokens (each segment carries a `#` or a known prefix), which the extractor above does not
 * read, so its tokens would silently skip validation. The grammar requires a source pointer to sit
 * on one line; this enforces it. A prose continuation ("The React Web guides describe…") has plain
 * words and is not flagged.
 */
function checkDanglingPointerLines(lines: string[], file: string): void {
  lines.forEach((rawLine, index) => {
    const line = rawLine.trim()
    if (line === '' || line.includes('source:') || line.startsWith('|') || line.startsWith('#')) {
      return
    }
    const segments = line.split(';').map((segment) => segment.trim().replace(/^`|`$|\.$/gu, ''))
    if (segments.length > 0 && segments.every(looksLikePointerToken)) {
      addProblem(
        file,
        index + 1,
        `line looks like wrapped source pointers ("${truncate(line)}") — a source: pointer must ` +
          `stay on its own single line so every token is validated`,
      )
    }
  })
}

/** A bare token that could only be a grammar pointer: has a known prefix or an `<sdk>#…` shape. */
function looksLikePointerToken(segment: string): boolean {
  if (segment === '') {
    return false
  }
  if (/^(impl|concept|kb|extern):/u.test(segment)) {
    return true
  }
  return /^[a-z0-9-]+#[^\s]/u.test(segment)
}

/**
 * Returns the pointer text after `source:` on a prose line, or undefined if the line is not one.
 * The `(?:^|\s)` guard means only a real `source:` token matches, not a substring like `datasource:`.
 * The everything-to-end-of-line capture is why the grammar forbids wrapping a pointer list (a wrapped
 * tail would be dropped here — checkDanglingPointerLines catches that).
 */
function matchProseSource(line: string): string | undefined {
  const match = /(?:^|\s)source:\s*(.+)$/u.exec(line)
  if (match?.[1] === undefined) {
    return undefined
  }
  // Strip a trailing sentence period that terminates the fact, not part of the last pointer.
  return match[1].trim().replace(/\.$/u, '')
}

/** Splits a `; `-separated pointer list into individual tokens, stripping backtick code spans. */
function splitTokens(pointerText: string): string[] {
  return pointerText
    .split(';')
    .map((token) => token.trim().replace(/^`|`$/gu, '').trim())
    .filter((token) => token !== '')
}

// --- token checking --------------------------------------------------------------------------

/**
 * Classifies and checks one pointer token. Prefixed forms (extern:/concept:/kb:/impl:) are handled
 * first; anything else must be the bare `<sdk>#<relpath>[#<symbol>]` source form.
 */
function checkToken(token: string, file: string, line: number): void {
  const prefixedCheck = checkPrefixedToken(token, file, line)
  if (prefixedCheck) {
    return
  }
  checkSourceToken(token, file, line)
}

/**
 * Handles the `extern:` / `concept:` / `kb:` / `impl:` forms. Returns true if the token had a known
 * prefix (whether or not it was valid), so the caller does not also treat it as an `<sdk>#…` pointer.
 * extern: is trusted (out-of-repo fact) as long as it has text; the rest must resolve to a real file.
 */
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

/** Resolves an `impl:<name>#<relpath>` token to a file under implementations/<name>/. */
function checkImplToken(token: string, file: string, line: number): void {
  const [name, relPath] = splitOnce(token.slice('impl:'.length), '#')
  if (name === undefined || relPath === undefined) {
    addProblem(file, line, `impl: pointer must be impl:<name>#<relpath>: "${token}"`)
    return
  }
  checkFile(path.join(implementationsDir, name, relPath), token, file, line)
}

/**
 * Resolves the core `<sdk>#<relpath>[#<symbol>]` form in three gates, reporting at the first failure:
 *   1. Arity + shape — exactly `<sdk>#<relpath>` or `<sdk>#<relpath>#<symbol>` (2 or 3 parts). A
 *      free-text pointer or a mistyped prefix lands here and gets the full grammar reminder.
 *   2. Known SDK — `<sdk>` must be a discovered package key; the error lists the valid keys.
 *   3. File, then symbol — the file must exist, and (if a symbol is given) that symbol must actually
 *      be declared in it. The symbol gate is what turns "the file is named right" into "the fact is
 *      still true"; it is the check that catches a renamed or moved export.
 */
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

/** Reports a problem unless `candidate` is an existing file. Shared by the impl:/concept:/kb: forms. */
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

/**
 * True if the list item at `index` has its `source:` on a following indented continuation line
 * (a fact may wrap across a few lines and end in `source:`). Scans up to CONTINUATION_LOOKAHEAD
 * lines, stopping early at a blank line or the next list item — either means this item has ended,
 * so a later `source:` belongs to something else.
 */
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

/**
 * True if a bullet is a pure cross-reference — it just points the reader at another doc ("Model: see
 * ../shared/concepts.md#…") rather than stating a fact of its own. Such a bullet inherits its source
 * from the referenced section and must NOT be required to carry a pointer.
 *
 * Detection: it must contain the word "see", and after stripping the list marker, an optional short
 * "Label:" lead-in, a leading "see", every markdown link, and every inline-code span, nothing but
 * punctuation may remain. A real fact leaves prose words behind and so is not treated as a reference.
 */
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

/**
 * Requires a per-SDK file's `##` section headings to equal _template.md's, in the same order, so
 * every SDK is documented against the same skeleton (an empty section keeps its heading with `None.`).
 * Reports the expected vs. actual heading lists on mismatch, anchored to the file's first heading.
 */
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

/**
 * Validates the KB→guide dependency link. Every per-SDK file declares the guide(s) its facts compose
 * into via a `<!-- feeds-guides: path[, path] -->` marker; the target guides must exist. This is the
 * downstream direction of the graph: given a changed KB fact, it names which guides must be recomposed
 * (the mirror of the source→KB direction that a fact's `source:` pointer gives). A per-SDK file with
 * no marker cannot be scoped incrementally, so it is required.
 */
function checkFeedsGuides(lines: string[], file: string): void {
  const markerLine = lines.findIndex((line) => line.includes('feeds-guides:'))
  if (markerLine === -1) {
    addProblem(
      file,
      1,
      `per-SDK file must declare which guide(s) it feeds: add ` +
        `<!-- feeds-guides: documentation/guides/<guide>.md -->`,
    )
    return
  }

  const match = /feeds-guides:\s*([^>]+?)\s*-->/u.exec(lines[markerLine] ?? '')
  const targets = (match?.[1] ?? '')
    .split(',')
    .map((target) => target.trim())
    .filter((target) => target !== '')

  if (targets.length === 0) {
    addProblem(file, markerLine + 1, `feeds-guides: marker lists no guide`)
    return
  }

  for (const target of targets) {
    if (!fileExists(path.join(rootDir, target))) {
      addProblem(file, markerLine + 1, `feeds-guides: → no such guide (${target})`)
    }
  }
}

/** The `##` section heading texts of a markdown file, in document order. */
function sectionHeadings(lines: string[]): string[] {
  return sectionLevel(headingsOf(lines)).map((heading) => heading.text)
}

/** Keeps only level-2 (`##`) headings. */
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

/**
 * Maps each package directory basename (the `<sdk>` grammar key) to its `src/` root, by scanning the
 * workspace for package.json files with a sibling src/. Deriving the keys instead of hardcoding them
 * means every SDK family is covered automatically and a new package is usable as a key the moment it
 * exists. A basename must be unique (it is the grammar key), so a collision throws rather than
 * silently shadowing one package with another; an empty result also throws (the scan is misrooted).
 */
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

/** Recursively finds every package.json under `dir`, skipping node_modules and dotfolders. */
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

/** Every `.md` file under `dir`, recursively, sorted so the report order is stable. */
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

/**
 * True for a per-SDK fact file — one that must pass coverage + template conformance. False for the
 * meta files (README/_template) and for anything under a shared/ directory, which mixes normative
 * prose with facts and so is held only to grammar + resolution.
 */
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

/**
 * Splits on the FIRST occurrence of `separator` (unlike String.split, which splits on all). Returns
 * `[before, after]`; if the separator is absent, `after` is undefined and `before` is the whole value
 * (or undefined when empty) — so `impl:foo` (no `#`) yields a defined name and undefined relpath,
 * which the caller reports as a malformed pointer.
 */
function splitOnce(value: string, separator: string): [string | undefined, string | undefined] {
  const index = value.indexOf(separator)
  if (index === -1) {
    return [value === '' ? undefined : value, undefined]
  }
  return [value.slice(0, index), value.slice(index + separator.length)]
}

/** Element-wise string-array equality (used to compare heading lists against the template). */
function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

/** A repo-relative path for readable problem messages. */
function rel(absPath: string): string {
  return path.relative(rootDir, absPath)
}

/** Shortens a fact excerpt for a problem message, adding an ellipsis when clipped. */
function truncate(value: string, max = SUMMARY_TRUNCATE): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

// --- reporting -------------------------------------------------------------------------------

/** Records one failure; collected across all files and emitted together by report(). */
function addProblem(file: string, line: number, message: string): void {
  problems.push({ file, line, message })
}

/**
 * Prints the outcome and sets the process exit code: a success line (exit 0) when clean, or the
 * problems sorted by file then line with a pointer to the grammar docs (exit 1) otherwise. Exit 1 is
 * what makes CI and the pre-commit path fail on knowledge-base drift.
 */
function report(): void {
  if (problems.length === 0) {
    console.log(
      '✓ SDK knowledge base: source pointers resolve, templates conform, and guide links are valid.',
    )
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
