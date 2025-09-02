import { http, type HttpHandler, HttpResponse } from 'msw'
import type { BatchInsightsEventArray } from '../lib/api-client/insights/dto'

// Minimal in-memory store
const eventsStore: BatchInsightsEventArray = []

// Helper to parse JSON whether body is application/json or text/plain
async function parseJson<T>(req: Request): Promise<T> {
  const content = req.headers.get('content-type') ?? ''
  if (content.includes('application/json')) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- no worries
    return (await req.json()) as T
  }
  // text/plain or others -> try text then JSON.parse
  // Beacon often sends text/plain with a JSON string body
  const raw = await req.text()
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- no worries
  return JSON.parse(raw) as T
}

// ---------------------------------
// MSW handlers for Insights API v1
// ---------------------------------
export function getHandlers(baseUrl = '*'): HttpHandler[] {
  return [
    // CORS preflight for Beacon/fetch
    http.options(
      `${baseUrl}/v1/organizations/:organizationId/environments/:environmentSlug/events`,
      () =>
        HttpResponse.text('', {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        }),
    ),
    http.post(
      `${baseUrl}/v1/organizations/:organizationId/environments/:environmentSlug/events`,
      async ({ request }) => {
        try {
          const payload = await parseJson<BatchInsightsEventArray>(request)

          eventsStore.push(...payload)

          return HttpResponse.text('', {
            status: 204,
            headers: { 'Access-Control-Allow-Origin': '*' },
          })
        } catch (e) {
          return HttpResponse.json(
            { error: 'Invalid payload', details: String(e) },
            { status: 400 },
          )
        }
      },
    ),
    // Debug endpoint that returns events for a given ID
    http.get(
      `${baseUrl}/v1/organizations/:organizationId/environments/:environmentSlug/profiles/:profileId`,
      ({ params }) => {
        const { profileId } = params
        const events = eventsStore.filter(
          (e) => e.profile.id === profileId || e.profile.stableId === profileId,
        )
        return HttpResponse.json({ data: events })
      },
    ),
  ]
}
