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

/** A bullet (`-`/`*`) or ordered (`1.`) list item. */
export function isListItem(line: string): boolean {
  return /^[-*]\s|^\d+\.\s/u.test(line)
}
