/** Validates the deterministic contract between guide blueprints and rendered integration guides. */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { headingsOf, isTableDivider, parseTableRow } from './sdk-knowledge/markdown'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const blueprintDir = path.join(rootDir, 'documentation/authoring/blueprints')
const templatePath = path.join(blueprintDir, '_template.md')
const requiredFrontmatter = ['sdk', 'archetype', 'kb', 'guide'] as const
const sectionMapColumns = [
  'Section',
  'Category',
  'Purpose',
  'Must teach or show',
  'Fact sources',
] as const
const categories = new Set([
  'Required for first integration',
  'Common but policy-dependent',
  'Optional',
  'Advanced or production-only',
])
const guideSectionHeadingLevel = 3
const tableHeaderRowCount = 2

interface Problem {
  file: string
  line: number
  message: string
}

interface SectionRow {
  title: string
  category: string
  line: number
}

const problems: Problem[] = []

function relative(file: string): string {
  return path.relative(rootDir, file)
}

function addProblem(file: string, line: number, message: string): void {
  problems.push({ file: relative(file), line, message })
}

function parseFrontmatter(file: string, lines: string[]): Map<string, string> {
  const result = new Map<string, string>()
  if (lines[0] !== '---') {
    addProblem(file, 1, 'missing opening frontmatter delimiter')
    return result
  }
  const end = lines.indexOf('---', 1)
  if (end === -1) {
    addProblem(file, 1, 'missing closing frontmatter delimiter')
    return result
  }
  lines.slice(1, end).forEach((line, index) => {
    const match = /^([a-z-]+):\s*(.+)$/u.exec(line)
    if (match?.[1] !== undefined && match[2] !== undefined) {
      result.set(match[1], match[2].trim())
    } else if (line.trim() !== '') {
      addProblem(file, index + 2, `invalid frontmatter line: ${line}`)
    }
  })
  return result
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/<[^>]+>/gu, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/gu, '-')
}

function validateLink(file: string, line: number, target: string): void {
  if (/^(?:https?:)?\/\//u.test(target) || target.startsWith('mailto:')) {
    return
  }
  const [rawPath = '', rawAnchor] = target.split('#', 2)
  const resolved =
    rawPath === '' ? file : path.resolve(path.dirname(file), decodeURIComponent(rawPath))
  if (!existsSync(resolved)) {
    addProblem(file, line, `link target does not exist: ${target}`)
    return
  }
  if (rawAnchor === undefined || rawAnchor === '') {
    return
  }
  const targetLines = readFileSync(resolved, 'utf8').split(/\r?\n/u)
  const anchors = new Set(headingsOf(targetLines).map((heading) => slug(heading.text)))
  if (!anchors.has(rawAnchor)) {
    addProblem(file, line, `link anchor does not exist: ${target}`)
  }
}

function validateLinks(file: string, lines: string[]): void {
  lines.forEach((line, index) => {
    for (const match of line.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)) {
      if (match[1] !== undefined) {
        validateLink(file, index + 1, match[1])
      }
    }
  })
}

function validateLinkRoles(file: string, lines: string[]): void {
  const headings = headingsOf(lines)
  const rolesHeading = headings.find(
    (heading) => heading.level === 2 && heading.text === 'Link roles',
  )
  if (rolesHeading === undefined) {
    return
  }
  const endLine =
    headings.find((heading) => heading.level === 2 && heading.line > rolesHeading.line)?.line ??
    lines.length + 1
  const roles = lines.slice(rolesHeading.line, endLine - 1).filter((line) => line.startsWith('- '))
  if (roles.length === 0) {
    addProblem(file, rolesHeading.line, 'Link roles must contain at least one linked relationship')
    return
  }
  roles.forEach((role, index) => {
    if (!/\[[^\]]+\]\([^)]+\)/u.test(role)) {
      addProblem(file, rolesHeading.line + index + 1, 'each Link role must contain a Markdown link')
    }
  })
}

function sectionMapTable(lines: string[]): { firstLine: number; lines: string[] } | undefined {
  const headings = headingsOf(lines)
  const sectionHeading = headings.find(
    (heading) => heading.level === 2 && heading.text === 'Section map',
  )
  if (sectionHeading === undefined) {
    return undefined
  }
  const endLine =
    headings.find((heading) => heading.level === 2 && heading.line > sectionHeading.line)?.line ??
    lines.length + 1
  return {
    firstLine: sectionHeading.line,
    lines: lines.slice(sectionHeading.line, endLine - 1),
  }
}

function sectionMapHeader(
  file: string,
  table: { firstLine: number; lines: string[] },
): number | undefined {
  const { lines: tableLines } = table
  const headerOffset = tableLines.findIndex((line) => {
    const cells = parseTableRow(line)
    return cells?.join('\0') === sectionMapColumns.join('\0')
  })
  if (headerOffset === -1) {
    addProblem(file, table.firstLine, 'Section map table has the wrong columns')
    return undefined
  }
  const divider = parseTableRow(tableLines[headerOffset + 1] ?? '')
  if (divider === undefined || !isTableDivider(divider)) {
    addProblem(file, table.firstLine + headerOffset + 1, 'Section map table lacks a divider')
    return undefined
  }
  return headerOffset
}

function validateSectionMapContent(file: string, line: number, values: string[]): void {
  if (values.some((value) => value === '')) {
    addProblem(file, line, 'Section map cells must all be non-empty')
  }
}

function validateSectionMapCategory(file: string, line: number, category: string): void {
  if (!categories.has(category)) {
    addProblem(file, line, `unknown integration category: ${category}`)
  }
}

function validateSectionMapFacts(file: string, line: number, facts: string): void {
  if (!/\[[^\]]+\]\([^)]+\)/u.test(facts)) {
    addProblem(file, line, 'Fact sources must contain at least one KB link')
  }
}

function sectionMapRow(file: string, line: number, cells: string[]): SectionRow | undefined {
  if (cells.length !== sectionMapColumns.length) {
    addProblem(
      file,
      line,
      `Section map row has ${cells.length} cells; expected ${sectionMapColumns.length}`,
    )
    return undefined
  }
  const [title = '', category = '', purpose = '', teaching = '', facts = ''] = cells
  validateSectionMapContent(file, line, [title, purpose, teaching, facts])
  validateSectionMapCategory(file, line, category)
  validateSectionMapFacts(file, line, facts)
  return { title, category, line }
}

function sectionRows(file: string, lines: string[]): SectionRow[] {
  const table = sectionMapTable(lines)
  if (table === undefined) {
    return []
  }
  const headerOffset = sectionMapHeader(file, table)
  if (headerOffset === undefined) {
    return []
  }
  return table.lines
    .slice(headerOffset + tableHeaderRowCount)
    .map((tableLine, index) => {
      const cells = parseTableRow(tableLine)
      const line = table.firstLine + headerOffset + tableHeaderRowCount + index + 1
      return cells === undefined ? undefined : sectionMapRow(file, line, cells)
    })
    .filter((row): row is SectionRow => row !== undefined)
}

function guideRows(file: string): SectionRow[] {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/u)
  const headings = headingsOf(lines)
  const rows: SectionRow[] = []
  headings.forEach((heading, index) => {
    if (heading.level !== guideSectionHeadingLevel) {
      return
    }
    const nextLine = headings[index + 1]?.line ?? lines.length + 1
    const categoryLine = lines
      .slice(heading.line, nextLine - 1)
      .find((line) => /^\*\*Integration category:\*\*\s+/u.test(line))
    if (categoryLine === undefined) {
      addProblem(file, heading.line, `section lacks an integration category: ${heading.text}`)
      return
    }
    rows.push({
      title: heading.text,
      category: categoryLine.replace(/^\*\*Integration category:\*\*\s+/u, ''),
      line: heading.line,
    })
  })
  return rows
}

function validateGuideMarkers(file: string, lines: string[]): void {
  lines.forEach((line, index) => {
    if (/\bESCALATE\b/u.test(line)) {
      addProblem(file, index + 1, 'public guide contains an unresolved ESCALATE marker')
    }
  })
}

function compareRows(blueprint: string, guide: string, expected: SectionRow[]): void {
  const actual = guideRows(guide)
  const length = Math.max(expected.length, actual.length)
  for (let index = 0; index < length; index += 1) {
    const planned = expected.at(index)
    const rendered = actual.at(index)
    if (planned === undefined) {
      addProblem(
        guide,
        rendered?.line ?? 1,
        `guide has unplanned section: ${rendered?.title ?? ''}`,
      )
      continue
    }
    if (rendered === undefined) {
      addProblem(blueprint, planned.line, `guide is missing planned section: ${planned.title}`)
      continue
    }
    if (planned.title !== rendered.title || planned.category !== rendered.category) {
      addProblem(
        blueprint,
        planned.line,
        `plan/guide mismatch at position ${index + 1}: expected "${planned.title}" (${planned.category}), got "${rendered.title}" (${rendered.category})`,
      )
    }
  }
}

const templateLines = readFileSync(templatePath, 'utf8').split(/\r?\n/u)
const templateSections = headingsOf(templateLines)
  .filter((heading) => heading.level === 2)
  .map((heading) => heading.text)
const blueprintFiles = readdirSync(blueprintDir)
  .filter((name) => name.endsWith('.md') && name !== '_template.md')
  .sort()

let sectionCount = 0
for (const name of blueprintFiles) {
  const file = path.join(blueprintDir, name)
  const lines = readFileSync(file, 'utf8').split(/\r?\n/u)
  const frontmatter = parseFrontmatter(file, lines)
  requiredFrontmatter.forEach((key) => {
    if (!frontmatter.has(key)) {
      addProblem(file, 1, `missing frontmatter key: ${key}`)
    }
  })
  const sections = headingsOf(lines)
    .filter((heading) => heading.level === 2)
    .map((heading) => heading.text)
  if (sections.join('\0') !== templateSections.join('\0')) {
    addProblem(file, 1, `blueprint headings do not match _template.md: ${sections.join(' -> ')}`)
  }
  validateLinks(file, lines)
  validateLinkRoles(file, lines)
  const rows = sectionRows(file, lines)
  sectionCount += rows.length

  const guideTarget = frontmatter.get('guide')
  const kbTarget = frontmatter.get('kb')
  if (guideTarget !== undefined) {
    const guide = path.resolve(path.dirname(file), guideTarget)
    if (!existsSync(guide)) {
      addProblem(file, 1, `guide target does not exist: ${guideTarget}`)
    } else {
      const guideLines = readFileSync(guide, 'utf8').split(/\r?\n/u)
      validateLinks(guide, guideLines)
      validateGuideMarkers(guide, guideLines)
      compareRows(file, guide, rows)
    }
  }
  if (kbTarget !== undefined && !existsSync(path.resolve(path.dirname(file), kbTarget))) {
    addProblem(file, 1, `KB target does not exist: ${kbTarget}`)
  }
}

if (problems.length > 0) {
  problems
    .sort((left, right) =>
      left.file === right.file ? left.line - right.line : left.file.localeCompare(right.file),
    )
    .forEach((problem) => {
      process.stderr.write(`${problem.file}:${problem.line}: ${problem.message}\n`)
    })
  process.exitCode = 1
} else {
  process.stdout.write(
    `✓ Guide authoring: ${blueprintFiles.length} blueprint(s), ${sectionCount} planned section(s), links and rendered guide structure valid.\n`,
  )
}
