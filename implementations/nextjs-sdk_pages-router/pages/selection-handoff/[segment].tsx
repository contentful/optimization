import { EntryCardContent } from '@/components/EntryCardContent'
import {
  loadRequiredPageEntries,
  staticPublicHandoffMissingRequiredEntryBehavior,
  type ContentEntry,
} from '@/lib/contentful'
import {
  createPublicPermutationHandoff,
  OptimizedEntry,
  type PagesRouterContentHandoff,
} from '@/lib/optimization'
import { CUSTOMER_SEGMENTS, type CustomerSegmentSlug } from 'e2e-web'
import type { GetStaticPaths, GetStaticProps } from 'next'
import type { JSX } from 'react'

type FixtureCustomerSegment = (typeof CUSTOMER_SEGMENTS)[CustomerSegmentSlug]

interface SelectionHandoffProps {
  readonly contentfulOptimization: {
    readonly consent: boolean
    readonly handoff: PagesRouterContentHandoff
  }
  readonly entries: ContentEntry[]
}

function getCustomerSegment(slug: string): FixtureCustomerSegment | undefined {
  if (!Object.prototype.hasOwnProperty.call(CUSTOMER_SEGMENTS, slug)) return undefined
  return CUSTOMER_SEGMENTS[slug as CustomerSegmentSlug]
}

function createCustomerSegmentCacheTags(segment: FixtureCustomerSegment): readonly string[] {
  return [`ctfl-opt-segment:${segment.slug}:v${segment.cacheVersion}`]
}

export const getStaticPaths: GetStaticPaths = () => ({
  fallback: false,
  paths: Object.keys(CUSTOMER_SEGMENTS).map((segment) => ({ params: { segment } })),
})

export const getStaticProps: GetStaticProps<SelectionHandoffProps> = async ({ params }) => {
  const segmentSlug = params?.segment

  if (typeof segmentSlug !== 'string') {
    return { notFound: true }
  }

  const segment = getCustomerSegment(segmentSlug)

  if (segment === undefined) {
    return { notFound: true }
  }

  const entries = await loadRequiredPageEntries([segment.baselineEntryId], {
    onMissingEntry: staticPublicHandoffMissingRequiredEntryBehavior,
  })
  if (entries === undefined) {
    return { notFound: true }
  }

  const handoff = createPublicPermutationHandoff({
    cacheVersion: segment.cacheVersion,
    entryIds: segment.baselineEntryIds,
    hydration: 'preserve-server',
    initialPageEvent: 'emit',
    locale: segment.locale,
    permutationKey: segment.slug,
    selectedOptimizations: segment.selectedOptimizations.map((selection) => ({
      ...selection,
      variants: { ...selection.variants },
    })),
    tags: createCustomerSegmentCacheTags(segment),
  })

  return {
    props: {
      contentfulOptimization: { consent: false, handoff },
      entries,
    },
    revalidate: 60,
  }
}

export default function SelectionHandoffPage({
  contentfulOptimization,
  entries,
}: SelectionHandoffProps): JSX.Element {
  return (
    <section className="page-section" data-testid="pages-selection-handoff-route">
      <header className="page-section__header">
        <h1>Selection Handoff</h1>
        <p data-testid="pages-selection-cache-key">{contentfulOptimization.handoff.cache.key}</p>
      </header>
      <div className="entry-grid">
        {entries.map((entry) => (
          <section className="entry-card" key={entry.sys.id}>
            <OptimizedEntry
              baselineEntry={entry}
              data-testid={`pages-selection-entry-${entry.sys.id}`}
            >
              {(resolvedEntry) => (
                <EntryCardContent
                  entry={resolvedEntry as ContentEntry}
                  labelEntryId={entry.sys.id}
                  testId={`pages-selection-${entry.sys.id}`}
                />
              )}
            </OptimizedEntry>
          </section>
        ))}
      </div>
    </section>
  )
}
