/** Generic, knowledge-base-agnostic markdown parsing helpers used by the validator. */

export interface Heading {
  level: number
  line: number
  text: string
}

/** ATX headings (`#`..`######`), skipping fenced code blocks so `# comment` lines are not counted. */
export function headingsOf(lines: string[]): Heading[] {
  const headings: Heading[] = []
  let inFence = false

  lines.forEach((rawLine, index) => {
    if (/^\s*```/u.test(rawLine)) {
      inFence = !inFence
      return
    }
    if (inFence) {
      return
    }
    const match = /^(#{1,6})\s+(.+?)\s*$/u.exec(rawLine)
    if (match?.[1] !== undefined && match[2] !== undefined) {
      headings.push({ level: match[1].length, line: index + 1, text: match[2] })
    }
  })

  return headings
}

/** Splits a `| a | b |` table row into trimmed cells, or returns undefined for a non-row line. */
export function parseTableRow(line: string): string[] | undefined {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
    return undefined
  }
  // Split on unescaped pipes only, then unescape `\|` within each cell — a `Returns` column value
  // like `ReactElement \| null` is one cell, not two, so its `null` is never misread as a pointer.
  return trimmed
    .slice(1, -1)
    .split(/(?<!\\)\|/u)
    .map((cell) => cell.trim().replace(/\\\|/gu, '|'))
}

/** A `| --- | :--: |` divider row separating a table header from its body. */
export function isTableDivider(columns: string[]): boolean {
  return columns.every((cell) => /^:?-+:?$/u.test(cell) || cell === '')
}

/** An empty-ish table cell that carries no pointer (em dash, hyphen, or "none"). */
export function isPlaceholderCell(cell: string): boolean {
  return cell === '—' || cell === '-' || cell.toLowerCase() === 'none'
}

/**
 * Visits every table BODY row that sits under a `source` column, yielding its 1-based line number
 * and that row's raw source-column cell (`''` when the row is too short to have one). Threads the
 * per-table source-column index exactly as the grammar requires: the column may sit at any index and
 * differ between tables in one file, is (re)set on a `| … | source |` header, and cleared when the
 * table ends (a blank or non-table line). Header rows, divider rows, and rows in tables with no
 * `source` column at all are not visited. Both pointer extraction (which reads the cell's tokens) and
 * coverage (which flags an empty/placeholder cell) walk tables through this one function.
 */
export function eachTableSourceCell(
  lines: string[],
  visit: (lineNumber: number, cell: string) => void,
): void {
  let sourceColumnIndex: number | undefined = undefined

  lines.forEach((rawLine, index) => {
    const line = rawLine.trimEnd()
    const columns = parseTableRow(line)
    if (columns === undefined) {
      if (line === '' || !line.includes('|')) {
        sourceColumnIndex = undefined
      }
      return
    }

    const headerIndex = columns.findIndex((cell) => cell.toLowerCase() === 'source')
    if (headerIndex !== -1) {
      sourceColumnIndex = headerIndex
      return
    }
    if (isTableDivider(columns) || sourceColumnIndex === undefined) {
      return
    }

    visit(index + 1, columns[sourceColumnIndex] ?? '')
  })
}

/** A bullet (`-`/`*`) or ordered (`1.`) list item. */
export function isListItem(line: string): boolean {
  return /^[-*]\s|^\d+\.\s/u.test(line)
}

/**
 * True if the list item at `index` is a single-line fact — nothing continues it. The next line is
 * end-of-file, blank, another list item, or the item's own `source:` line. If instead an indented
 * prose continuation follows, this bullet line is mid-fact (its terminal clause and pointer are
 * below), so it must not be judged as a complete fact here. Multi-line facts are graded via their
 * trailing `source:` line instead.
 */
export function isFactUnitEnd(lines: string[], index: number): boolean {
  const { [index + 1]: next } = lines
  if (next === undefined) {
    return true
  }
  const trimmed = next.trim()
  return trimmed === '' || isListItem(trimmed) || trimmed.includes('source:')
}

/**
 * True for a `**Label:**` or `Label:` bullet that only introduces a group of sub-bullets. Such a
 * lead-in states no fact of its own; the group's shared `source:` sits on its last child, so the
 * lead-in must not be required to carry its own pointer.
 */
export function isLabelLeadIn(line: string): boolean {
  const withoutMarker = line.replace(/^[-*]\s+/u, '')
  return withoutMarker.endsWith(':') || withoutMarker.endsWith(':**')
}

/**
 * A heuristic for "this list item is an SDK fact that must be sourced" vs prose guidance. Facts
 * reference a concrete symbol/config key/path/identifier as inline code. A bullet that only
 * delegates to another doc ("Model: see ../shared/concepts.md#…") is a cross-reference, not a fact.
 */
export function looksLikeFact(line: string, labelLeadInMax: number): boolean {
  if (!/`[^`]+`/u.test(line)) {
    return false
  }
  return !isCrossReference(line, labelLeadInMax)
}

/**
 * True if a bullet is a pure cross-reference — it just points the reader at another doc ("Model: see
 * ../shared/concepts.md#…") rather than stating a fact of its own. Such a bullet inherits its source
 * from the referenced section and must NOT be required to carry a pointer.
 *
 * Detection: it must contain the word "see", and after stripping the list marker, an optional short
 * "Label:" lead-in (up to `labelLeadInMax` chars), a leading "see", every markdown link, and every
 * inline-code span, nothing but punctuation may remain. A real fact leaves prose words behind and so
 * is not treated as a reference.
 */
export function isCrossReference(line: string, labelLeadInMax: number): boolean {
  if (!/\bsee\b/iu.test(line)) {
    return false
  }
  const body = line
    .replace(/^[-*]\s+|^\d+\.\s+/u, '')
    .replace(new RegExp(`^[^:]{0,${labelLeadInMax}}:\\s*`, 'u'), '')
    .replace(/^see\s+/iu, '')
  const withoutLinks = body.replace(/\[[^\]]*\]\([^)]*\)/gu, '').replace(/`[^`]*`/gu, '')
  return withoutLinks.replace(/[\s.,;]/gu, '') === ''
}
