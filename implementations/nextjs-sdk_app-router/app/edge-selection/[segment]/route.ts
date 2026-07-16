import { getCustomerSegment } from '@/lib/customer-segments'
import {
  createEdgeCustomerSegmentCacheMetadata,
  createEdgeHandoffFromSelections,
} from '@/lib/edge-optimization'

export const runtime = 'edge'

export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<{ readonly segment: string }> },
): Promise<Response> {
  const { segment: segmentSlug } = await params
  const segment = getCustomerSegment(segmentSlug)

  if (segment === undefined) {
    return Response.json({ error: 'Unknown segment' }, { status: 404 })
  }

  const cacheMetadata = createEdgeCustomerSegmentCacheMetadata(segment)
  const handoff = createEdgeHandoffFromSelections({
    cache: {
      ...cacheMetadata,
    },
    hydration: 'preserve-server',
    initialPageEvent: 'emit',
    selectedOptimizations: segment.selectedOptimizations,
  })

  return Response.json(
    {
      cache: handoff.cache,
      hydration: handoff.hydration,
      initialPageEvent: handoff.initialPageEvent,
      selectedOptimizations: handoff.state?.selectedOptimizations ?? [],
    },
    {
      headers: {
        'x-optimization-cache-scope': handoff.cache.scope,
        'x-optimization-cache-key': cacheMetadata.key,
      },
    },
  )
}
