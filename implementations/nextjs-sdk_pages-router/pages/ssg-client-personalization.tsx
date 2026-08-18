import { EntryCardContent } from '@/components/EntryCardContent'
import {
  loadRequiredPageEntries,
  staticPublicHandoffMissingRequiredEntryBehavior,
  type ContentEntry,
} from '@/lib/contentful'
import { OptimizedEntry } from '@/lib/optimization'
import { useOptimizationContext } from '@contentful/optimization-nextjs/client'
import { CUSTOMER_SEGMENTS } from 'e2e-web'
import type { GetStaticProps } from 'next'
import { useCallback, useState, type JSX } from 'react'

const readinessSegment = CUSTOMER_SEGMENTS['new-visitor']

interface SsgClientPersonalizationProps {
  readonly baselineEntry: ContentEntry
}

export const getStaticProps: GetStaticProps<SsgClientPersonalizationProps> = async () => {
  const entries = await loadRequiredPageEntries([readinessSegment.baselineEntryId], {
    onMissingEntry: staticPublicHandoffMissingRequiredEntryBehavior,
  })
  const baselineEntry = entries?.[0]

  if (baselineEntry === undefined) {
    return { notFound: true }
  }

  return { props: { baselineEntry } }
}

export default function SsgClientPersonalizationPage({
  baselineEntry,
}: SsgClientPersonalizationProps): JSX.Element {
  const { isLive, sdk } = useOptimizationContext()
  const hasAdoptedLiveSdk = isLive === true && sdk !== undefined
  const [isResolved, setIsResolved] = useState(false)
  const revealResolvedEntry = useCallback(() => {
    if (hasAdoptedLiveSdk) {
      setIsResolved(true)
    }
  }, [hasAdoptedLiveSdk])
  // Remount at live adoption so the static snapshot cannot replay a queued resolved callback.
  const optimizedEntryAdoptionKey = hasAdoptedLiveSdk ? 'live-sdk' : 'static-snapshot'

  return (
    <section aria-busy={!isResolved} className="page-section" data-testid="readiness-ssg-route">
      <header className="page-section__header">
        <h1>Shared SSG client personalization</h1>
        <p>
          This route serves shared static entry markup and reveals it after client-side
          personalization resolves.
        </p>
      </header>

      <p aria-live="polite" data-testid="readiness-ssg-loading" hidden={isResolved} role="status">
        Loading personalized content...
      </p>

      <div data-testid="readiness-ssg-entry" hidden={!isResolved}>
        <section className="entry-card">
          <OptimizedEntry
            key={optimizedEntryAdoptionKey}
            baselineEntry={baselineEntry}
            onEntryResolved={revealResolvedEntry}
          >
            {(resolvedEntry) => <EntryCardContent entry={resolvedEntry} />}
          </OptimizedEntry>
        </section>
      </div>
    </section>
  )
}
