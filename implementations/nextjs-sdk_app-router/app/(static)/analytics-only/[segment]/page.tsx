import { EntryCardContent } from '@/components/EntryCardContent'
import { loadPageEntries, type ContentEntry } from '@/lib/contentful'
import { getCustomerSegment, getCustomerSegmentStaticParams } from '@/lib/customer-segments'
import {
  createCustomerSegmentCacheMetadata,
  getServerTrackingAttributes,
  resolveEntriesForSelections,
} from '@/lib/optimization'
import { notFound } from 'next/navigation'

export const revalidate = 60

export function generateStaticParams() {
  return getCustomerSegmentStaticParams()
}

export default async function AnalyticsOnlyPage({
  params,
}: {
  readonly params: Promise<{ readonly segment: string }>
}) {
  const { segment: segmentSlug } = await params
  const segment = getCustomerSegment(segmentSlug)

  if (segment === undefined) notFound()

  const entries = await loadPageEntries([segment.baselineEntryId])
  const resolvedEntries = resolveEntriesForSelections({
    entries,
    selectedOptimizations: segment.selectedOptimizations,
  })
  const cacheMetadata = createCustomerSegmentCacheMetadata(segment)

  return (
    <section className="page-section" data-testid="analytics-only-route">
      <header className="page-section__header">
        <h1>Analytics Only</h1>
        <p data-testid="analytics-cache-key">{cacheMetadata.key}</p>
      </header>
      <div className="entry-grid">
        {resolvedEntries.map((resolvedData) => {
          const entry = resolvedData.entry as ContentEntry

          return (
            <section
              className="entry-card"
              data-testid={`analytics-entry-${resolvedData.baselineEntry.sys.id}`}
              key={resolvedData.baselineEntry.sys.id}
              {...getServerTrackingAttributes(resolvedData.baselineEntry, resolvedData)}
            >
              {resolvedData.isEmptyVariant ? null : (
                <EntryCardContent
                  entry={entry}
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
