import { loadPageEntries, type ContentEntry, type ContentEntrySkeleton } from '@/lib/contentful'
import { getCustomerSegment, type CustomerSegment } from '@/lib/customer-segments'
import {
  createEdgeCustomerSegmentCacheMetadata,
  createEdgeHandoffFromSelections,
  getServerTrackingAttributes,
} from '@/lib/edge-optimization'
import { isResolvedContentfulEntry } from '@contentful/optimization-nextjs/api-schemas'
import { notFound } from 'next/navigation'
import { EdgeHtmlAnalyticsRoot } from './EdgeHtmlAnalyticsRoot'

export const runtime = 'edge'

type SelectedOptimization = CustomerSegment['selectedOptimizations'][number]

function findLinkedVariantEntry(
  baselineEntry: ContentEntry,
  experienceId: string,
  variantEntryId: string,
): ContentEntry | undefined {
  const experiences = getResolvedEntryArrayField(baselineEntry, 'nt_experiences')
  const selectedExperience = experiences.find((experience) => experience.sys.id === experienceId)
  const variants =
    selectedExperience === undefined
      ? experiences.flatMap((experience) => getResolvedEntryArrayField(experience, 'nt_variants'))
      : getResolvedEntryArrayField(selectedExperience, 'nt_variants')

  return variants.find((variant): variant is ContentEntry => variant.sys.id === variantEntryId)
}

function getResolvedEntryArrayField(entry: ContentEntry, fieldName: string): ContentEntry[] {
  const value = (entry.fields as Record<string, unknown>)[fieldName]
  if (!Array.isArray(value)) return []

  return value.filter((item): item is ContentEntry =>
    isResolvedContentfulEntry<ContentEntrySkeleton>(item),
  )
}

function resolveSegmentEntry(
  baselineEntry: ContentEntry,
  segment: CustomerSegment,
): {
  readonly entry: ContentEntry
  readonly selectedOptimization?: SelectedOptimization
} {
  const selectedOptimization = segment.selectedOptimizations.find((selection) =>
    Object.prototype.hasOwnProperty.call(selection.variants, baselineEntry.sys.id),
  )
  if (selectedOptimization === undefined) {
    return {
      entry: baselineEntry,
    }
  }

  const variantEntryId = selectedOptimization.variants[baselineEntry.sys.id]
  const entry =
    variantEntryId === undefined
      ? baselineEntry
      : (findLinkedVariantEntry(baselineEntry, selectedOptimization.experienceId, variantEntryId) ??
        baselineEntry)

  return {
    entry,
    selectedOptimization,
  }
}

export default async function EdgeHtmlPage({
  params,
}: {
  readonly params: Promise<{ readonly segment: string }>
}) {
  const { segment: segmentSlug } = await params
  const segment = getCustomerSegment(segmentSlug)

  if (segment === undefined) notFound()

  const [baselineEntry] = await loadPageEntries([segment.baselineEntryId])

  if (baselineEntry === undefined) notFound()

  const routeKey = `/edge-html/${segment.slug}`
  const cacheMetadata = createEdgeCustomerSegmentCacheMetadata(segment)
  const handoff = createEdgeHandoffFromSelections({
    cache: {
      ...cacheMetadata,
    },
    hydration: 'analytics-only',
    initialPageEvent: 'emit',
    selectedOptimizations: segment.selectedOptimizations,
  })
  const resolvedData = resolveSegmentEntry(baselineEntry, segment)
  const entryText =
    typeof resolvedData.entry.fields.text === 'string' ? resolvedData.entry.fields.text : ''

  return (
    <EdgeHtmlAnalyticsRoot handoff={handoff} routeKey={routeKey}>
      <section className="page-section" data-testid="edge-html-route">
        <header className="page-section__header">
          <h1>Edge HTML</h1>
          <p data-testid="edge-html-cache-key">{cacheMetadata.key}</p>
        </header>
        <article
          className="entry-card"
          data-testid={`edge-html-entry-${baselineEntry.sys.id}`}
          {...getServerTrackingAttributes(baselineEntry, resolvedData)}
        >
          <div
            data-ctfl-entry-id={resolvedData.entry.sys.id}
            data-test-entry-id={resolvedData.entry.sys.id}
            data-testid={`content-edge-html-${baselineEntry.sys.id}`}
          >
            <p data-testid={`edge-html-entry-text-${baselineEntry.sys.id}`}>{entryText}</p>
            <p>{`[Entry: ${baselineEntry.sys.id}]`}</p>
          </div>
        </article>
      </section>
    </EdgeHtmlAnalyticsRoot>
  )
}
