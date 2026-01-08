/* eslint-disable no-console -- CLI */

import type { Entry } from 'contentful'
import { get } from 'es-toolkit/compat'
import fs from 'fs-extra'
import path from 'node:path'
import process from 'node:process'
import retry from 'p-retry'

// -----------------------------------
// Constants
// -----------------------------------

const MAX_BACKOFF_MS = 8000
const DEFAULT_RETRY_DELAY_MS = 500
const MAX_RETRIES = 5
const BASE_TWO = 2
const ENV_FALLBACK = 'master'
const EXPORT_JSON_PATH = './src/contentful/data/space/ctfl-space-data.json'
const OUTPUT_DIRECTORY = './src/contentful/data/entries'
const CONTENTFUL_CONFIG_PATH = './.contentfulrc.json'

// -----------------------------------
// Type guards & safe accessors
// -----------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isEntry(value: unknown): value is Entry {
  return isRecord(value) && 'fields' in value
}

function firstLocaleValue(valueByLocale: unknown): unknown {
  if (!isRecord(valueByLocale)) return undefined
  if (Object.hasOwn(valueByLocale, 'en-US')) {
    const { 'en-US': v } = valueByLocale
    return v
  }
  const keys = Object.keys(valueByLocale)
  const [firstKey] = keys
  if (!firstKey) return undefined
  const { [firstKey]: firstValue } = valueByLocale
  return firstValue
}

function getField(entry: Entry, fieldId: string): unknown {
  const { fields } = entry
  if (!isRecord(fields)) return undefined
  const { [fieldId]: localized } = fields
  return firstLocaleValue(localized)
}

function normalizeEntryId(candidate: unknown): string | undefined {
  if (typeof candidate === 'string') return candidate
  if (isRecord(candidate)) {
    const id: unknown = get(candidate, ['sys', 'id'])
    return typeof id === 'string' ? id : undefined
  }
  return undefined
}

function getSysId(entry: Entry): string | undefined {
  const { sys } = entry
  const id = get(sys, ['id'])
  return typeof id === 'string' ? id : undefined
}

function getContentTypeId(entry: Entry): string | undefined {
  const { sys } = entry
  const id = get(sys, ['contentType', 'sys', 'id'])
  return typeof id === 'string' ? id : undefined
}

function getStringField(entry: Entry, fieldId: string): string | undefined {
  const v = getField(entry, fieldId)
  return typeof v === 'string' ? v : undefined
}

function getRecordField(entry: Entry, fieldId: string): Record<string, unknown> | undefined {
  const v = getField(entry, fieldId)
  return isRecord(v) ? v : undefined
}

// -----------------------------------
// Retry helper
// -----------------------------------

async function executeWithRetry<T>(action: () => Promise<T>): Promise<T> {
  return await retry(action, {
    retries: MAX_RETRIES,
    factor: BASE_TWO,
    minTimeout: DEFAULT_RETRY_DELAY_MS,
    maxTimeout: MAX_BACKOFF_MS,
    onFailedAttempt: (context) => {
      console.warn(`Attempt ${context.attemptNumber} failed. ${context.retriesLeft} retries left.`)
    },
  })
}

// -----------------------------------
// IO & client builders
// -----------------------------------

async function getContentfulConfig(): Promise<{
  spaceId: string
  environmentId: string
  deliveryToken: string
}> {
  const configExists = await fs.pathExists(CONTENTFUL_CONFIG_PATH)
  if (!configExists) {
    throw new Error(`Missing .contentfulrc.json at ${CONTENTFUL_CONFIG_PATH}`)
  }
  const raw = await fs.readFile(CONTENTFUL_CONFIG_PATH, 'utf8')
  const parsed: unknown = JSON.parse(raw)
  if (!isRecord(parsed)) throw new Error('Invalid .contentfulrc.json format')

  const spaceId = typeof parsed.spaceId === 'string' ? parsed.spaceId : undefined
  const environmentId =
    typeof parsed.environmentId === 'string' ? parsed.environmentId : ENV_FALLBACK
  const deliveryToken = typeof parsed.deliveryToken === 'string' ? parsed.deliveryToken : undefined

  if (!spaceId || !deliveryToken) {
    throw new Error('Missing required Contentful configuration fields: spaceId or accessToken')
  }
  return { spaceId, environmentId, deliveryToken }
}

function getEntriesFromExport(parsed: unknown): readonly Entry[] {
  const entries: unknown = get(parsed, ['entries'])
  if (!Array.isArray(entries)) return [] as const
  const result: Entry[] = []
  for (const item of entries) {
    if (isEntry(item)) result.push(item)
  }
  return result
}

async function readExportEntries(): Promise<readonly Entry[]> {
  const raw = await fs.readFile(EXPORT_JSON_PATH, 'utf8')
  const parsed: unknown = JSON.parse(raw)
  return getEntriesFromExport(parsed)
}

async function ensureOutputDir(dir: string): Promise<void> {
  await fs.ensureDir(dir)
}

async function fetchEntryJSON(entryId: string): Promise<string> {
  const { spaceId, environmentId, deliveryToken } = await getContentfulConfig()

  const url = new URL(
    `https://cdn.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries`,
  )
  url.searchParams.set('sys.id', entryId)
  url.searchParams.set('include', '10')

  const text = await executeWithRetry(async () => {
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${deliveryToken}`,
      },
    })

    return await response.text()
  })

  return text
}

async function writeJsonFile(filePath: string, data: string): Promise<void> {
  await fs.writeJson(filePath, JSON.parse(data), { spaces: BASE_TWO })
}

// -----------------------------------
// Domain logic
// -----------------------------------

function collectBaselineIds(entries: readonly Entry[]): readonly string[] {
  const ids: string[] = []
  const seen = new Set<string>()

  for (const entry of entries) {
    const ntType = getStringField(entry, 'nt_type')
    if (ntType !== 'nt_personalization' && ntType !== 'nt_experiment') continue

    const config = getRecordField(entry, 'nt_config')
    if (!config) continue

    const baselineId = normalizeEntryId(get(config, 'components[0].baseline.id'))

    if (!baselineId) continue

    const key = `${ntType}:${baselineId}`
    if (seen.has(key)) continue
    seen.add(key)

    ids.push(baselineId)
  }

  return ids
}

function collectMergeTagIds(entries: readonly Entry[]): readonly string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const entry of entries) {
    const typeId = getContentTypeId(entry)
    if (typeId !== 'mergeTagContent') continue
    const id = getSysId(entry)
    if (id && !seen.has(id)) {
      seen.add(id)
      ids.push(id)
    }
  }
  return ids
}

function collectAudienceIds(entries: readonly Entry[]): readonly string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const entry of entries) {
    const typeId = getContentTypeId(entry)
    if (typeId !== 'nt_audience') continue
    const id = getSysId(entry)
    if (id && !seen.has(id)) {
      seen.add(id)
      ids.push(id)
    }
  }
  return ids
}

function collectExperienceIds(entries: readonly Entry[]): readonly string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const entry of entries) {
    const typeId = getContentTypeId(entry)
    if (typeId !== 'nt_experience') continue
    const id = getSysId(entry)
    if (id && !seen.has(id)) {
      seen.add(id)
      ids.push(id)
    }
  }
  return ids
}

function collectPersonalizationIds(entries: readonly Entry[]): readonly string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const entry of entries) {
    const typeId = getContentTypeId(entry)
    if (typeId !== 'nt_personalization') continue
    const id = getSysId(entry)
    if (id && !seen.has(id)) {
      seen.add(id)
      ids.push(id)
    }
  }
  return ids
}

async function processEntries(entryIds: readonly string[], outputDir: string): Promise<void> {
  for (const id of entryIds) {
    const outPath = path.join(outputDir, `${id}.json`)

    try {
      const data = await fetchEntryJSON(id)
      await writeJsonFile(outPath, data)

      console.info(`Saved entry → ${outPath}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)

      console.error(`Failed to fetch entry ${id}: ${message}`)
    }
  }
}

// -----------------------------------
// Main orchestrator
// -----------------------------------

async function main(): Promise<void> {
  const outRoot = path.resolve(OUTPUT_DIRECTORY)
  await ensureOutputDir(outRoot)

  const entries = await readExportEntries()
  if (entries.length === 0) {
    console.warn('No entries found in export. Is this a valid Contentful export JSON?')
  }

  const baselineIds = collectBaselineIds(entries)
  const mergeTagIds = collectMergeTagIds(entries)
  const audienceIds = collectAudienceIds(entries)
  const experienceIds = collectExperienceIds(entries)
  const personalizationIds = collectPersonalizationIds(entries)
  await processEntries(
    [...baselineIds, ...mergeTagIds, ...audienceIds, ...experienceIds, ...personalizationIds],
    outRoot,
  )

  console.info('Done.')
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? (err.stack ?? err.message) : String(err)
  console.error(message)
  process.exit(1)
})
