import { AppShell } from '@/components/AppShell'
import { getCustomerSegment } from '@/lib/customer-segments'
import {
  createCustomerSegmentAnalyticsHandoff,
  createRoutePagePayload,
  OptimizationAnalyticsRoot,
} from '@/lib/optimization'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

export default async function AnalyticsOnlyLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode
  params: Promise<{ readonly segment: string }>
}>) {
  const { segment: segmentSlug } = await params
  const segment = getCustomerSegment(segmentSlug)

  if (segment === undefined) notFound()

  const routeKey = `/analytics-only/${segment.slug}`
  const pagePayload = createRoutePagePayload(routeKey, routeKey)
  const handoff = createCustomerSegmentAnalyticsHandoff(segment)

  return (
    <OptimizationAnalyticsRoot
      buildPagePayload={() => pagePayload}
      handoff={handoff}
      routeKey={routeKey}
    >
      <AppShell analyticsOnly>{children}</AppShell>
    </OptimizationAnalyticsRoot>
  )
}
