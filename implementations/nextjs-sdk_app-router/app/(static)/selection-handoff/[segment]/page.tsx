import { EntryCardContent } from '@/components/EntryCardContent'
import {
  loadRequiredPageEntries,
  staticPublicHandoffMissingRequiredEntryBehavior,
} from '@/lib/contentful'
import { getCustomerSegment, getCustomerSegmentStaticParams } from '@/lib/customer-segments'
import { createCustomerSegmentHandoff, ExplicitOptimizedEntry } from '@/lib/optimization'
import { cacheLife, cacheTag } from 'next/cache'
import { notFound } from 'next/navigation'

export function generateStaticParams() {
  return getCustomerSegmentStaticParams()
}

async function loadSelectionHandoffPage(segmentSlug: string) {
  'use cache'

  cacheLife({ revalidate: 60 })

  const segment = getCustomerSegment(segmentSlug)

  if (segment === undefined) return undefined

  const entries = await loadRequiredPageEntries([segment.baselineEntryId], {
    onMissingEntry: staticPublicHandoffMissingRequiredEntryBehavior,
  })
  if (entries === undefined) return undefined

  const handoff = createCustomerSegmentHandoff(segment)
  if (handoff.cache.tags !== undefined) cacheTag(...handoff.cache.tags)

  return { entries, handoff }
}

export default async function SelectionHandoffPage({
  params,
}: {
  readonly params: Promise<{ readonly segment: string }>
}) {
  const { segment: segmentSlug } = await params
  const pageData = await loadSelectionHandoffPage(segmentSlug)

  if (pageData === undefined) notFound()

  return (
    <section className="page-section" data-testid="selection-handoff-route">
      <header className="page-section__header">
        <h1>Selection Handoff</h1>
        <p data-testid="selection-cache-key">{pageData.handoff.cache.key}</p>
      </header>
      <div className="entry-grid">
        {pageData.entries.map((baselineEntry) => (
          <section
            className="entry-card"
            data-testid={`content-entry-${baselineEntry.sys.id}`}
            key={baselineEntry.sys.id}
          >
            <ExplicitOptimizedEntry baselineEntry={baselineEntry}>
              {(resolvedEntry, { resolvedData }) => {
                return resolvedData.isEmptyVariant ? null : (
                  <EntryCardContent
                    entry={resolvedEntry}
                    labelEntryId={baselineEntry.sys.id}
                    testId={baselineEntry.sys.id}
                  />
                )
              }}
            </ExplicitOptimizedEntry>
          </section>
        ))}
      </div>
    </section>
  )
}
