import { readFileSync, writeFileSync } from 'node:fs'
import { isRecord } from './typeGuards'

interface Scm {
  url?: string
}

interface Library {
  artifactVersion?: string
  licenses?: string[]
  name?: string
  scm?: Scm
  uniqueId?: string
  website?: string
}

interface License {
  content?: string
  name?: string
  spdxId?: string
  url?: string
}

const ARGUMENT_OFFSET = 2
const [inputPath, outputPath] = process.argv.slice(ARGUMENT_OFFSET)

if (!inputPath || !outputPath) {
  process.stderr.write(
    'Usage: tsx scripts/format-android-third-party-notices.ts <input.json> <output.txt>\n',
  )
  process.exit(1)
}

const report: unknown = JSON.parse(readFileSync(inputPath, 'utf8'))
const libraries = getLibraries(report)
const licenses = getLicenses(report)

function isOptionalString(value: unknown): boolean {
  return typeof value === 'string' || value === undefined
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isScm(value: unknown): value is Scm {
  return isRecord(value) && isOptionalString(value.url)
}

function isLibrary(value: unknown): value is Library {
  return (
    isRecord(value) &&
    isOptionalString(value.artifactVersion) &&
    (isStringArray(value.licenses) || value.licenses === undefined) &&
    isOptionalString(value.name) &&
    (isScm(value.scm) || value.scm === undefined) &&
    isOptionalString(value.uniqueId) &&
    isOptionalString(value.website)
  )
}

function isLicense(value: unknown): value is License {
  return (
    isRecord(value) &&
    isOptionalString(value.content) &&
    isOptionalString(value.name) &&
    isOptionalString(value.spdxId) &&
    isOptionalString(value.url)
  )
}

function isLicenseMap(value: unknown): value is Record<string, License> {
  return isRecord(value) && Object.values(value).every(isLicense)
}

function getLibraries(report: unknown): Library[] {
  return isRecord(report) && Array.isArray(report.libraries)
    ? report.libraries.filter(isLibrary)
    : []
}

function getLicenses(report: unknown): Record<string, License> {
  return isRecord(report) && isLicenseMap(report.licenses) ? report.licenses : {}
}

function compactUnique(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function renderLicense(licenseId: string): string {
  const { [licenseId]: license } = licenses

  if (!license) {
    return `License: ${licenseId}`
  }

  const { content, name: licenseName, spdxId, url } = license
  const name = licenseName ?? spdxId ?? licenseId

  if (content) {
    return `${name}\n\n${content}`
  }

  if (url) {
    return `License: ${name}\nLicense URL: ${url}`
  }

  return `License: ${name}`
}

function renderLibrary(library: Library): string {
  const {
    artifactVersion,
    licenses: libraryLicenses,
    name: displayName,
    scm,
    uniqueId,
    website,
  } = library
  const name = uniqueId ?? displayName ?? 'unknown'
  const version = artifactVersion ?? 'unknown'
  const projectUrls = compactUnique([website, scm?.url])
  const licenseIds = libraryLicenses ?? []

  const lines = [
    `The following software may be included in this product: ${name} (${version})`,
    'This software contains the following license and notice below:',
    '',
  ]

  if (projectUrls.length > 0) {
    lines.push(...projectUrls.map((url) => `Project URL: ${url}`), '')
  }

  if (licenseIds.length > 0) {
    lines.push(...licenseIds.map(renderLicense))
  } else {
    lines.push('No license information found.')
  }

  return lines.join('\n').trimEnd()
}

const output = libraries.map(renderLibrary).join('\n\n---\n\n')
writeFileSync(outputPath, `${output}\n`, 'utf8')
