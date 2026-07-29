import { getCustomerSegment } from '@/lib/customer-segments'
import { createEdgeCustomerSegmentHandoff } from '@/lib/edge-optimization'
import { assertEdgeRuntime } from '@/lib/edge-runtime'

export const runtime = 'edge'

export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<{ readonly segment: string }> },
): Promise<Response> {
  const runtimeWitness = assertEdgeRuntime()
  const { segment: segmentSlug } = await params
  const segment = getCustomerSegment(segmentSlug)

  if (segment === undefined) {
    return Response.json({ error: 'Unknown segment', runtime: runtimeWitness }, { status: 404 })
  }

  const handoff = createEdgeCustomerSegmentHandoff(segment)
  const cacheKey = handoff.cache.key

  if (cacheKey === undefined) {
    throw new Error('Edge public permutation handoff requires a cache key.')
  }

  return Response.json(
    {
      cache: handoff.cache,
      hydration: handoff.hydration,
      initialPageEvent: handoff.initialPageEvent,
      runtime: runtimeWitness,
      selectedOptimizations: handoff.state?.selectedOptimizations ?? [],
    },
    {
      headers: {
        'x-edge-runtime-witness': runtimeWitness.witness,
        'x-optimization-cache-key': cacheKey,
        'x-optimization-cache-scope': handoff.cache.scope,
      },
    },
  )
}
