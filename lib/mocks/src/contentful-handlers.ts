import { http, type HttpHandler, HttpResponse } from 'msw'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const BASE_DIR = './src/contentful/data/entries'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

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

async function handleContentTypeQuery(contentType: string, cursor = false): Promise<Response> {
  try {
    const allEntries = await loadAllEntries()
    const filtered = allEntries.filter((e) => getContentTypeId(e) === contentType)

    if (cursor) {
      return HttpResponse.json(
        { sys: { type: 'Array' }, limit: 100, pages: {}, items: filtered },
        { headers: CORS_HEADERS, status: 200 },
      )
    } else {
      return HttpResponse.json(
        { sys: { type: 'Array' }, total: filtered.length, skip: 0, limit: 100, items: filtered },
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

async function handleEntryIdQuery(entryId: string): Promise<Response> {
  const filePath = path.join(BASE_DIR, `${entryId}.json`)
  try {
    const text = await readFile(filePath, 'utf8')
    const json: unknown = JSON.parse(text)
    if (!isRecord(json)) throw new Error()
    return HttpResponse.json(json, { headers: CORS_HEADERS, status: 200 })
  } catch (err) {
    return handleEntryIdError(err, entryId)
  }
}

// TODO: Figure out how to make fixtures available from both server (this package) and test (dependent packages) contexts
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
      `${baseUrl}spaces/:spaceId/environments/:environmentId/entries`,
      async ({ request }) => {
        const url = new URL(request.url)
        const entryId = url.searchParams.get('sys.id')
        const contentType = url.searchParams.get('content_type')
        const cursor = url.searchParams.get('cursor')

        if (contentType) {
          return await handleContentTypeQuery(contentType, cursor === 'true')
        }

        if (entryId) {
          return await handleEntryIdQuery(entryId)
        }

        return HttpResponse.json(
          { error: 'Missing "sys.id" or "content_type" query parameter.' },
          { headers: CORS_HEADERS, status: 400 },
        )
      },
    ),
  ]
}
