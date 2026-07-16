import { EntryCardContent } from '@/components/EntryCardContent'
import { loadPageEntries, type ContentEntry } from '@/lib/contentful'
import { getCustomerSegment, getCustomerSegmentStaticParams } from '@/lib/customer-segments'
import { createCustomerSegmentCacheMetadata, OptimizedEntry } from '@/lib/optimization'
import { notFound } from 'next/navigation'

export const revalidate = 60

export function generateStaticParams() {
  return getCustomerSegmentStaticParams()
}

export default async function SelectionHandoffPage({
  params,
}: {
  readonly params: Promise<{ readonly segment: string }>
}) {
  const { segment: segmentSlug } = await params
  const segment = getCustomerSegment(segmentSlug)

  if (segment === undefined) notFound()

  const entries = await loadPageEntries([segment.baselineEntryId])
  const cacheMetadata = createCustomerSegmentCacheMetadata(segment)

  return (
    <section className="page-section" data-testid="selection-handoff-route">
      <header className="page-section__header">
        <h1>Selection Handoff</h1>
        <p data-testid="selection-cache-key">{cacheMetadata.key}</p>
      </header>
      <div className="entry-grid">
        {entries.map((baselineEntry) => (
          <section
            className="entry-card"
            data-testid={`content-entry-${baselineEntry.sys.id}`}
            key={baselineEntry.sys.id}
          >
            <OptimizedEntry baselineEntry={baselineEntry}>
              {(resolvedEntry, { resolvedData }) => {
                const entry = resolvedEntry as ContentEntry

                return resolvedData.isEmptyVariant ? null : (
                  <EntryCardContent
                    entry={entry}
                    labelEntryId={baselineEntry.sys.id}
                    testId={baselineEntry.sys.id}
                  />
                )
              }}
            </OptimizedEntry>
          </section>
        ))}
      </div>
    </section>
  )
}
