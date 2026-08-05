import { EntryCardContent } from '@/components/EntryCardContent'
import {
  loadRequiredPageEntries,
  staticPublicHandoffMissingRequiredEntryBehavior,
} from '@/lib/contentful'
import { getCustomerSegment, getCustomerSegmentStaticParams } from '@/lib/customer-segments'
import {
  createCustomerSegmentAnalyticsHandoff,
  getServerTrackingAttributes,
  resolveEntriesForSelections,
} from '@/lib/optimization'
import { cacheLife, cacheTag } from 'next/cache'
import { notFound } from 'next/navigation'

export function generateStaticParams() {
  return getCustomerSegmentStaticParams()
}

async function loadAnalyticsOnlyPage(segmentSlug: string) {
  'use cache'

  cacheLife({ revalidate: 60 })

  const segment = getCustomerSegment(segmentSlug)

  if (segment === undefined) return undefined

  const entries = await loadRequiredPageEntries([segment.baselineEntryId], {
    onMissingEntry: staticPublicHandoffMissingRequiredEntryBehavior,
  })
  if (entries === undefined) return undefined

  const resolvedEntries = resolveEntriesForSelections({
    entries,
    selectedOptimizations: segment.selectedOptimizations,
  })
  const handoff = createCustomerSegmentAnalyticsHandoff(segment)
  if (handoff.cache.tags !== undefined) cacheTag(...handoff.cache.tags)

  return { handoff, resolvedEntries }
}

export default async function AnalyticsOnlyPage({
  params,
}: {
  readonly params: Promise<{ readonly segment: string }>
}) {
  const { segment: segmentSlug } = await params
  const pageData = await loadAnalyticsOnlyPage(segmentSlug)

  if (pageData === undefined) notFound()

  return (
    <section className="page-section" data-testid="analytics-only-route">
      <header className="page-section__header">
        <h1>Analytics Only</h1>
        <p data-testid="analytics-cache-key">{pageData.handoff.cache.key}</p>
      </header>
      <div className="entry-grid">
        {pageData.resolvedEntries.map((resolvedData) => {
          return (
            <section
              className="entry-card"
              data-testid={`analytics-entry-${resolvedData.baselineEntry.sys.id}`}
              key={resolvedData.baselineEntry.sys.id}
              {...getServerTrackingAttributes(resolvedData.baselineEntry, resolvedData)}
            >
              {resolvedData.isEmptyVariant ? null : (
                <EntryCardContent
                  entry={resolvedData.entry}
                  labelEntryId={resolvedData.baselineEntry.sys.id}
                  testId={`analytics-${resolvedData.baselineEntry.sys.id}`}
                />
              )}
            </section>
          )
        })}
      </div>
    </section>
  )
}
