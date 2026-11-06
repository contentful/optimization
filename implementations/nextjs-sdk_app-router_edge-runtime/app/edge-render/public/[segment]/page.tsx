import { EdgeHandoffRoot } from '@/app/edge-render/EdgeHandoffRoot'
import { getCustomerSegment } from '@/lib/customer-segments'
import { loadEdgeRenderedEntry } from '@/lib/edge-content'
import { createEdgeCustomerSegmentHandoff } from '@/lib/edge-optimization'
import { assertEdgeRuntime } from '@/lib/edge-runtime'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export default async function EdgePublicPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly segment: string }>
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  assertEdgeRuntime()
  const { segment: slug } = await params
  const segment = getCustomerSegment(slug)
  if (segment === undefined) notFound()

  const handoff = createEdgeCustomerSegmentHandoff(segment)
  if (handoff.hydration !== 'preserve-server') {
    throw new Error('Public Edge rendering requires a content handoff.')
  }
  const entry = await loadEdgeRenderedEntry({
    baselineId: segment.baselineEntryId,
    locale: segment.locale,
    selectedOptimizations: segment.selectedOptimizations,
  })
  const routeKeyUrl = new URL(`/edge-render/public/${segment.slug}`, 'http://localhost')
  for (const [name, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      routeKeyUrl.searchParams.append(name, item)
    }
  }
  const routeKey = `${routeKeyUrl.pathname}${routeKeyUrl.search}`

  return (
    <EdgeHandoffRoot consent={false} handoff={handoff} routeKey={routeKey}>
      <main>
        <h1>Public Edge selection: {segment.label}</h1>
        <article {...entry.trackingAttributes} data-testid="edge-rendered-entry">
          <p>{entry.text}</p>
        </article>
        <Link href="/edge-render/private" prefetch={false}>
          View personalized Edge request
        </Link>
      </main>
    </EdgeHandoffRoot>
  )
}
