import { isRecord } from '@contentful/optimization-api-schemas'
import { http, type HttpHandler, HttpResponse } from 'msw'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const BASE_DIR = './src/contentful/data/entries'
const SPACE_DATA_PATH = './src/contentful/data/space/ctfl-space-data.json'
/** Mirrors the `limit` Contentful SDKs send when reading the space's locales. */
const LOCALES_LIMIT = 1000

function getContentTypeId(entry: Record<string, unknown>): string | undefined {
  const { sys } = entry
  if (!isRecord(sys)) return undefined
  const { contentType } = sys
  if (!isRecord(contentType)) return undefined
  const { sys: innerSys } = contentType
  if (!isRecord(innerSys)) return undefined
  return typeof innerSys.id === 'string' ? innerSys.id : undefined
}

function extractEntriesFromFile(json: Record<string, unknown>): Array<Record<string, unknown>> {
  const entries: Array<Record<string, unknown>> = []

  const { items } = json
  if (Array.isArray(items)) {
    for (const item of items) {
      if (isRecord(item)) entries.push(item)
    }
  }

  const { includes } = json
  if (isRecord(includes)) {
    const { Entry: includesEntry } = includes
    if (Array.isArray(includesEntry)) {
      for (const item of includesEntry) {
        if (isRecord(item)) entries.push(item)
      }
    }
  }

  return entries
}

async function loadAllEntries(): Promise<Array<Record<string, unknown>>> {
  const files = await readdir(BASE_DIR)
  const jsonFiles = files.filter((f) => f.endsWith('.json'))

  const allEntries: Array<Record<string, unknown>> = []
  const seenIds = new Set<string>()

  for (const file of jsonFiles) {
    const filePath = path.join(BASE_DIR, file)
    const text = await readFile(filePath, 'utf8')
    const json: unknown = JSON.parse(text)
    if (!isRecord(json)) continue

    const entries = extractEntriesFromFile(json)
    for (const entry of entries) {
      const { sys } = entry
      if (isRecord(sys) && typeof sys.id === 'string' && !seenIds.has(sys.id)) {
        seenIds.add(sys.id)
        allEntries.push(entry)
      }
    }
  }

  return allEntries
}

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' }

async function handleContentTypeQuery(
  contentType: string,
  searchParams: URLSearchParams,
): Promise<Response> {
  try {
    const allEntries = await loadAllEntries()
    const fieldFilters = [...searchParams].filter(([name]) => name.startsWith('fields.'))
    const filtered = allEntries.filter((entry) => {
      if (getContentTypeId(entry) !== contentType) return false

      const { fields } = entry
      return fieldFilters.every(
        ([name, value]) => isRecord(fields) && fields[name.slice('fields.'.length)] === value,
      )
    })
    const requestedLimit = Number(searchParams.get('limit') ?? 100)
    const limit = Number.isInteger(requestedLimit) && requestedLimit >= 0 ? requestedLimit : 100
    const requestedSkip = Number(searchParams.get('skip') ?? 0)
    const skip = Number.isInteger(requestedSkip) && requestedSkip >= 0 ? requestedSkip : 0
    // Paginate like the CDA: without honoring `skip`, every page returns the
    // first one and paging consumers silently loop over the same entries.
    const items = filtered.slice(skip, skip + limit)

    if (searchParams.get('cursor') === 'true') {
      return HttpResponse.json(
        { sys: { type: 'Array' }, limit, pages: {}, items },
        { headers: CORS_HEADERS, status: 200 },
      )
    } else {
      return HttpResponse.json(
        { sys: { type: 'Array' }, total: filtered.length, skip, limit, items },
        { headers: CORS_HEADERS, status: 200 },
      )
    }
  } catch {
    return HttpResponse.json(
      { error: 'Failed to load entries.' },
      { headers: CORS_HEADERS, status: 500 },
    )
  }
}

/**
 * Serves the space's locale set from the space fixture.
 *
 * Contentful SDKs that resolve locale fallback chains client-side, such as
 * `contentful.swift`, fetch this endpoint before their first entry query and
 * cannot decode entries without it. `contentful.js` sends `locale` to the API
 * instead, so web consumers never request it.
 */
async function handleLocalesQuery(searchParams: URLSearchParams): Promise<Response> {
  try {
    const text = await readFile(SPACE_DATA_PATH, 'utf8')
    const json: unknown = JSON.parse(text)
    const locales =
      isRecord(json) && Array.isArray(json.locales) ? json.locales.filter(isRecord) : []
    const requestedLimit = Number(searchParams.get('limit') ?? LOCALES_LIMIT)
    const limit =
      Number.isInteger(requestedLimit) && requestedLimit >= 0 ? requestedLimit : LOCALES_LIMIT

    return HttpResponse.json(
      {
        sys: { type: 'Array' },
        total: locales.length,
        skip: 0,
        limit,
        items: locales.slice(0, limit),
      },
      { headers: CORS_HEADERS, status: 200 },
    )
  } catch {
    return HttpResponse.json(
      { error: 'Failed to load locales.' },
      { headers: CORS_HEADERS, status: 500 },
    )
  }
}

function handleEntryIdError(err: unknown, entryId: string): Response {
  if (typeof err === 'object' && err && 'code' in err && err.code === 'ENOENT') {
    return HttpResponse.json(
      { error: `No JSON found for Entry ID "${entryId}".` },
      { headers: CORS_HEADERS, status: 404 },
    )
  }
  if (err instanceof SyntaxError) {
    return HttpResponse.json(
      { error: `Malformed JSON for Entry ID "${entryId}".` },
      { headers: CORS_HEADERS, status: 500 },
    )
  }
  return HttpResponse.json(
    { error: 'Internal server error.' },
    { headers: CORS_HEADERS, status: 500 },
  )
}

async function loadEntryFixture(entryId: string): Promise<Record<string, unknown>> {
  const filePath = path.join(BASE_DIR, `${entryId}.json`)
  const text = await readFile(filePath, 'utf8')
  const json: unknown = JSON.parse(text)
  if (!isRecord(json)) throw new Error()
  return json
}

async function handleEntryIdQuery(entryId: string): Promise<Response> {
  try {
    return HttpResponse.json(await loadEntryFixture(entryId), {
      headers: CORS_HEADERS,
      status: 200,
    })
  } catch (err) {
    return handleEntryIdError(err, entryId)
  }
}

async function handleEntryIdsQuery(entryIds: string): Promise<Response> {
  try {
    const fixtures = (
      await Promise.all(
        entryIds.split(',').map(async (entryId) => {
          try {
            return await loadEntryFixture(entryId)
          } catch (error) {
            if (isRecord(error) && error.code === 'ENOENT') return undefined
            throw error
          }
        }),
      )
    ).filter((fixture) => fixture !== undefined)
    const items = fixtures.flatMap(({ items }) =>
      Array.isArray(items) ? items.filter(isRecord) : [],
    )
    const Entry = fixtures.flatMap(({ includes }) => {
      if (!isRecord(includes) || !Array.isArray(includes.Entry)) return []
      return includes.Entry.filter(isRecord)
    })

    return HttpResponse.json(
      {
        sys: { type: 'Array' },
        total: items.length,
        skip: 0,
        limit: 100,
        items,
        includes: { Entry },
      },
      { headers: CORS_HEADERS, status: 200 },
    )
  } catch {
    return HttpResponse.json(
      { error: 'Failed to load entries.' },
      { headers: CORS_HEADERS, status: 500 },
    )
  }
}

/**
 * Returns MSW request handlers that mock the Contentful Content Delivery API.
 *
 * @param baseUrl - URL prefix prepended to each route pattern.
 * @returns An array of {@link HttpHandler} instances for use with MSW.
 *
 * @remarks
 * TODO: Figure out how to make fixtures available from both server (this package)
 * and test (dependent packages) contexts.
 *
 * @example
 * ```typescript
 * import { setupServer } from 'msw/node'
 * import { getHandlers } from './contentful-handlers'
 *
 * const server = setupServer(...getHandlers())
 * ```
 *
 * @public
 */
export function getHandlers(baseUrl = '*'): HttpHandler[] {
  return [
    // CORS preflight for Beacon/fetch
    http.options('*', () =>
      HttpResponse.text('', {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-contentful-user-agent',
        },
      }),
    ),

    http.get(
      `${baseUrl}spaces/:spaceId/environments/:environmentId/locales`,
      async ({ request }) => await handleLocalesQuery(new URL(request.url).searchParams),
    ),

    http.get(
      `${baseUrl}spaces/:spaceId/environments/:environmentId/entries`,
      async ({ request }) => {
        const url = new URL(request.url)
        const entryId = url.searchParams.get('sys.id')
        const entryIds = url.searchParams.get('sys.id[in]')
        const contentType = url.searchParams.get('content_type')

        if (contentType) {
          return await handleContentTypeQuery(contentType, url.searchParams)
        }

        if (entryId) {
          return await handleEntryIdQuery(entryId)
        }

        if (entryIds) {
          return await handleEntryIdsQuery(entryIds)
        }

        return HttpResponse.json(
          { error: 'Missing "sys.id" or "content_type" query parameter.' },
          { headers: CORS_HEADERS, status: 400 },
        )
      },
    ),
  ]
}
