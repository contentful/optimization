import { type JSX, useEffect, useMemo, useState } from 'react'
import { useOptimization } from '../optimization/hooks/useOptimization'
import {
  type PersonalizationSelection,
  usePersonalization,
} from '../optimization/hooks/usePersonalization'
import { useLiveUpdates } from '../optimization/liveUpdates/LiveUpdatesContext'
import type { ContentfulEntry } from '../types/contentful'

interface LiveUpdatesSectionProps {
  baselineEntry: ContentfulEntry
}

interface LiveUpdatesEntryDisplayProps {
  entry: ContentfulEntry
  testIdPrefix: string
}

function LiveUpdatesEntryDisplay({
  entry,
  testIdPrefix,
}: LiveUpdatesEntryDisplayProps): JSX.Element {
  const text = typeof entry.fields.text === 'string' ? entry.fields.text : 'No content'
  const fullLabel = `${text} [Entry: ${entry.sys.id}]`

  return (
    <div data-testid={`${testIdPrefix}-container`}>
      <p data-testid={`${testIdPrefix}-text`} aria-label={fullLabel}>
        {text}
      </p>
      <p data-testid={`${testIdPrefix}-entry-id`}>Entry: {entry.sys.id}</p>
    </div>
  )
}

interface LiveUpdatesPersonalizationProps {
  baselineEntry: ContentfulEntry
  sectionId: string
  testIdPrefix: string
  title: string
  description: string
  liveUpdates?: boolean
}

function LiveUpdatesPersonalization({
  baselineEntry,
  sectionId,
  testIdPrefix,
  title,
  description,
  liveUpdates,
}: LiveUpdatesPersonalizationProps): JSX.Element {
  const { sdk, isReady } = useOptimization()
  const { resolveEntry } = usePersonalization()
  const liveUpdatesContext = useLiveUpdates()

  const shouldLiveUpdate =
    liveUpdatesContext?.previewPanelVisible === true ||
    (liveUpdates ?? liveUpdatesContext?.globalLiveUpdates ?? false)

  const [lockedPersonalizations, setLockedPersonalizations] = useState<
    PersonalizationSelection | undefined
  >(undefined)

  useEffect(() => {
    if (!isReady || sdk === undefined) {
      setLockedPersonalizations(undefined)
      return
    }

    const subscription = sdk.states.personalizations.subscribe((nextPersonalizations) => {
      if (shouldLiveUpdate) {
        setLockedPersonalizations(nextPersonalizations)
        return
      }

      if (lockedPersonalizations === undefined && nextPersonalizations !== undefined) {
        setLockedPersonalizations(nextPersonalizations)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [isReady, lockedPersonalizations, sdk, shouldLiveUpdate])

  const { entry: resolvedEntry } = useMemo(
    () => resolveEntry(baselineEntry, lockedPersonalizations),
    [baselineEntry, lockedPersonalizations, resolveEntry],
  )

  return (
    <section data-testid={sectionId}>
      <h3>{title}</h3>
      <p>{description}</p>
      <LiveUpdatesEntryDisplay entry={resolvedEntry} testIdPrefix={testIdPrefix} />
    </section>
  )
}

export function LiveUpdatesSection({
  baselineEntry,
}: LiveUpdatesSectionProps): JSX.Element {
  const liveUpdatesContext = useLiveUpdates()
  const remountKey = `${liveUpdatesContext?.globalLiveUpdates ?? false}-${liveUpdatesContext?.previewPanelVisible ?? false}`

  return (
    <div key={remountKey} style={{ display: 'grid', gap: 16 }}>
      <LiveUpdatesPersonalization
        baselineEntry={baselineEntry}
        sectionId="default-personalization"
        testIdPrefix="default"
        title="Default Behavior (inherits global setting)"
        description="No liveUpdates prop - inherits from OptimizationRoot (false)."
      />
      <LiveUpdatesPersonalization
        baselineEntry={baselineEntry}
        sectionId="live-personalization"
        testIdPrefix="live"
        title="Live Updates Enabled (liveUpdates=true)"
        description="Always updates when personalization state changes."
        liveUpdates={true}
      />
      <LiveUpdatesPersonalization
        baselineEntry={baselineEntry}
        sectionId="locked-personalization"
        testIdPrefix="locked"
        title="Locked (liveUpdates=false)"
        description="Never updates - locks to first variant received."
        liveUpdates={false}
      />
    </div>
  )
}
