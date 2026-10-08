import { EdgeHandoffRoot } from '@/app/edge-render/EdgeHandoffRoot'
import { getCustomerSegment } from '@/lib/customer-segments'
import { loadEdgeRenderedEntry } from '@/lib/edge-content'
import { createEdgeRequestHandoff } from '@/lib/edge-optimization'
import { assertEdgeRuntime } from '@/lib/edge-runtime'
import { getAppConsent } from '@/lib/util'
import { cookies, headers } from 'next/headers'
import Link from 'next/link'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const ROUTE_KEY = '/edge-render/private'

export default async function EdgePrivatePage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  assertEdgeRuntime()
  const requestHeaders = await headers()
  const requestCookies = await cookies()
  const consent = getAppConsent(requestCookies)
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'http'
  const host =
    requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? 'localhost:3003'
  const requestUrl = new URL(ROUTE_KEY, `${protocol}://${host}`)
  for (const [name, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      requestUrl.searchParams.append(name, item)
    }
  }
  const routeKey = `${ROUTE_KEY}${requestUrl.search}`
  const { data, handoff } = await createEdgeRequestHandoff({
    cache: { scope: 'private-request' },
    hydration: 'preserve-server',
    pagePayload: { properties: { path: ROUTE_KEY, url: requestUrl.toString() } },
    request: { headers: new Headers(requestHeaders), url: requestUrl.toString() },
  })
  if (handoff.hydration !== 'preserve-server') {
    throw new Error('Private Edge rendering requires a content handoff.')
  }
  const segment = getCustomerSegment('new-visitor')
  if (segment === undefined) throw new Error('New-visitor customer segment is missing.')
  const entry = await loadEdgeRenderedEntry({
    baselineId: segment.baselineEntryId,
    locale: segment.locale,
    selectedOptimizations: data?.selectedOptimizations,
  })

  return (
    <EdgeHandoffRoot consent={consent} handoff={handoff} routeKey={routeKey}>
      <main>
        <h1>Personalized Edge request</h1>
        <article {...entry.trackingAttributes} data-testid="edge-rendered-entry">
          <p>{entry.text}</p>
        </article>
        <Link href="/edge-render/public/new-visitor" prefetch={false}>
          View public Edge selection
        </Link>
      </main>
    </EdgeHandoffRoot>
  )
}
