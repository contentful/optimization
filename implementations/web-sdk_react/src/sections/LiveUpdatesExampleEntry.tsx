import type { SelectedPersonalizationArray } from '@contentful/optimization-web/api-schemas'
import { type JSX, useEffect, useMemo, useState } from 'react'
import { useOptimization } from '../optimization/hooks/useOptimization'
import { usePersonalization } from '../optimization/hooks/usePersonalization'
import { useLiveUpdates } from '../optimization/liveUpdates/LiveUpdatesContext'
import type { ContentfulEntry } from '../types/contentful'

interface LiveUpdatesExampleEntryProps {
  baselineEntry: ContentfulEntry
  liveUpdates?: boolean
  testIdPrefix: string
}

export function LiveUpdatesExampleEntry({
  baselineEntry,
  liveUpdates,
  testIdPrefix,
}: LiveUpdatesExampleEntryProps): JSX.Element {
  const { sdk, isReady } = useOptimization()
  const { resolveEntry } = usePersonalization()
  const liveUpdatesContext = useLiveUpdates()
  const [lockedSelectedPersonalizations, setLockedSelectedPersonalizations] = useState<
    SelectedPersonalizationArray | undefined
  >(undefined)

  const shouldLiveUpdate =
    liveUpdatesContext?.previewPanelVisible === true ||
    (liveUpdates ?? liveUpdatesContext?.globalLiveUpdates ?? false)

  useEffect(() => {
    if (!isReady || sdk === undefined) {
      setLockedSelectedPersonalizations(undefined)
      return
    }

    const subscription = sdk.states.selectedPersonalizations.subscribe(
      (nextSelectedPersonalizations) => {
        if (shouldLiveUpdate) {
          setLockedSelectedPersonalizations(nextSelectedPersonalizations)
          return
        }

        setLockedSelectedPersonalizations((currentPersonalizations) => {
          if (currentPersonalizations === undefined && nextSelectedPersonalizations !== undefined) {
            return nextSelectedPersonalizations
          }

          return currentPersonalizations
        })
      },
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [isReady, sdk, shouldLiveUpdate])

  const { entry: resolvedEntry } = useMemo(
    () => resolveEntry(baselineEntry, lockedSelectedPersonalizations),
    [baselineEntry, lockedSelectedPersonalizations, resolveEntry],
  )

  const text =
    typeof resolvedEntry.fields.text === 'string' ? resolvedEntry.fields.text : 'No content'
  const fullLabel = `${text} [Entry: ${resolvedEntry.sys.id}]`

  return (
    <div data-testid={`content-${testIdPrefix}`}>
      <p data-testid={`entry-text-${testIdPrefix}`} aria-label={fullLabel}>
        {text}
      </p>
      <p data-testid={`entry-id-${testIdPrefix}`}>Entry: {resolvedEntry.sys.id}</p>
    </div>
  )
}
