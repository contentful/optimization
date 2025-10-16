import { http, type HttpHandler, HttpResponse } from 'msw'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const BASE_DIR = './src/contentful/data/entries'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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

        if (!entryId) {
          return HttpResponse.json(
            { error: 'Missing "sys.id" query parameter.' },
            { headers: { 'Access-Control-Allow-Origin': '*' }, status: 400 },
          )
        }

        const filePath = path.join(BASE_DIR, `${entryId}.json`)

        try {
          const text = await readFile(filePath, 'utf8')
          const json: unknown = JSON.parse(text)

          if (!isRecord(json)) throw new Error()

          return HttpResponse.json(json, {
            headers: { 'Access-Control-Allow-Origin': '*' },
            status: 200,
          })
        } catch (err) {
          if (typeof err === 'object' && err && 'code' in err && err.code === 'ENOENT') {
            return HttpResponse.json(
              { error: `No JSON found for Entry ID "${entryId}".` },
              { headers: { 'Access-Control-Allow-Origin': '*' }, status: 404 },
            )
          }

          if (err instanceof SyntaxError) {
            return HttpResponse.json(
              { error: `Malformed JSON for Entry ID "${entryId}".` },
              { headers: { 'Access-Control-Allow-Origin': '*' }, status: 500 },
            )
          }

          return HttpResponse.json(
            { error: 'Internal server error.' },
            { headers: { 'Access-Control-Allow-Origin': '*' }, status: 500 },
          )
        }
      },
    ),
  ]
}
