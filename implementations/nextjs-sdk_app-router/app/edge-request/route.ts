import { createEdgeRequestHandoff } from '@/lib/edge-optimization'

export const runtime = 'edge'

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const { handoff, pageResult, persist } = await createEdgeRequestHandoff({
    cache: { scope: 'private-request' },
    hydration: 'preserve-server',
    pagePayload: { properties: { path: url.pathname, url: request.url } },
    request,
  })
  const response = Response.json(
    {
      accepted: pageResult.accepted,
      cache: handoff.cache,
      hasState: handoff.state !== undefined,
      hydration: handoff.hydration,
      initialPageEvent: handoff.initialPageEvent,
    },
    {
      headers: {
        'x-optimization-cache-scope': handoff.cache.scope,
      },
    },
  )

  persist(response)

  return response
}
