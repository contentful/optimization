import { AppShell } from '@/components/AppShell'
import { getCustomerSegment } from '@/lib/customer-segments'
import {
  createCustomerSegmentCacheMetadata,
  createHandoffFromSelections,
  createRoutePagePayload,
  OptimizationRoot,
} from '@/lib/optimization'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

export default async function SelectionHandoffLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode
  params: Promise<{ readonly segment: string }>
}>) {
  const { segment: segmentSlug } = await params
  const segment = getCustomerSegment(segmentSlug)

  if (segment === undefined) notFound()

  const routeKey = `/selection-handoff/${segment.slug}`
  const pagePayload = createRoutePagePayload(routeKey, routeKey)
  const cacheMetadata = createCustomerSegmentCacheMetadata(segment)
  const handoff = createHandoffFromSelections({
    cache: {
      ...cacheMetadata,
    },
    hydration: 'preserve-server',
    initialPageEvent: 'emit',
    selectedOptimizations: segment.selectedOptimizations,
  })

  return (
    <OptimizationRoot buildPagePayload={() => pagePayload} handoff={handoff} routeKey={routeKey}>
      <AppShell>{children}</AppShell>
    </OptimizationRoot>
  )
}
