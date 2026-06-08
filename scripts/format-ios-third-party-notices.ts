import { readFileSync, writeFileSync } from 'node:fs'

interface LicenseEntry {
  body: string
  name: string
  source?: string
}

const DEPENDENCY_HEADING_PREFIX = '## '
const MARKDOWN_LINK_HEADING_PATTERN = /^\[([^\]]+)\]\((.+)\)$/u
const NO_SWIFT_DEPENDENCIES_MESSAGE =
  'No Swift Package Manager production dependencies are declared for packages/ios/ContentfulOptimization.'

const ARGUMENT_OFFSET = 2
const [inputPath, outputPath] = process.argv.slice(ARGUMENT_OFFSET)

if (!inputPath || !outputPath) {
  process.stderr.write(
    'Usage: tsx scripts/format-ios-third-party-notices.ts <input.md> <output.txt>\n',
  )
  process.exit(1)
}

const markdown = readFileSync(inputPath, 'utf8')
const entries = parseLicensePlistMarkdown(markdown)
const output =
  entries.length > 0 ? entries.map(renderEntry).join('\n\n---\n\n') : NO_SWIFT_DEPENDENCIES_MESSAGE

writeFileSync(outputPath, `${output}\n`, 'utf8')

function parseLicensePlistMarkdown(markdownContent: string): LicenseEntry[] {
  const lines = markdownContent.replace(/\r\n/g, '\n').split('\n')
  const entries: LicenseEntry[] = []
  let currentEntry: LicenseEntry | undefined = undefined
  let currentBody: string[] = []

  for (const line of lines) {
    const heading = parseDependencyHeading(line)

    if (heading) {
      if (currentEntry) {
        entries.push({
          ...currentEntry,
          body: currentBody.join('\n').trim(),
        })
      }

      currentEntry = heading
      currentBody = []
      continue
    }

    if (currentEntry) {
      currentBody.push(line)
    }
  }

  if (currentEntry) {
    entries.push({
      ...currentEntry,
      body: currentBody.join('\n').trim(),
    })
  }

  return entries
}

function parseDependencyHeading(line: string): LicenseEntry | undefined {
  if (!line.startsWith(DEPENDENCY_HEADING_PREFIX)) {
    return undefined
  }

  const headingText = line.slice(DEPENDENCY_HEADING_PREFIX.length).trim()
  const linkedHeading = MARKDOWN_LINK_HEADING_PATTERN.exec(headingText)

  if (linkedHeading) {
    const [, name, source] = linkedHeading

    if (!name || !source) {
      return undefined
    }

    return {
      body: '',
      name,
      source,
    }
  }

  return {
    body: '',
    name: headingText,
  }
}

function renderEntry(entry: LicenseEntry): string {
  const { body, name, source } = entry
  const lines = [
    `The following software may be included in this product: ${name}`,
    'This software contains the following license and notice below:',
    '',
  ]

  if (source) {
    lines.push(`Project URL: ${source}`, '')
  }

  lines.push(body.length > 0 ? body : 'No license information found.')

  return lines.join('\n').trimEnd()
}
