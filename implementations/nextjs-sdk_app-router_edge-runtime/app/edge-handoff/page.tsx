import { createEdgeRequestHandoff } from '@/lib/edge-optimization'
import { assertEdgeRuntime } from '@/lib/edge-runtime'
import { headers } from 'next/headers'
import { EdgeHandoff } from './EdgeHandoff'

export const runtime = 'edge'

export default async function EdgeHandoffPage() {
  const runtimeWitness = assertEdgeRuntime()
  const requestHeaders = await headers()
  const origin =
    requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? 'localhost:3003'
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'http'
  const url = `${protocol}://${origin}/edge-handoff`
  const { handoff } = await createEdgeRequestHandoff({
    cache: { scope: 'private-request' },
    hydration: 'preserve-server',
    pagePayload: { properties: { path: '/edge-handoff', url } },
    request: { headers: requestHeaders, url },
  })
  if (handoff.hydration === 'analytics-only') {
    throw new Error('Edge request handoff must be content-capable.')
  }

  return (
    <EdgeHandoff handoff={handoff} routeKey="/edge-handoff">
      <main data-testid="edge-browser-handoff">
        <h1>Next.js Edge browser handoff</h1>
        <p data-testid="edge-browser-handoff-runtime">{runtimeWitness.witness}</p>
      </main>
    </EdgeHandoff>
  )
}
