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
  const [lockedPersonalizations, setLockedPersonalizations] = useState<
    SelectedPersonalizationArray | undefined
  >(undefined)

  const shouldLiveUpdate =
    liveUpdatesContext?.previewPanelVisible === true ||
    (liveUpdates ?? liveUpdatesContext?.globalLiveUpdates ?? false)

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

      setLockedPersonalizations((currentPersonalizations) => {
        if (currentPersonalizations === undefined && nextPersonalizations !== undefined) {
          return nextPersonalizations
        }

        return currentPersonalizations
      })
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [isReady, sdk, shouldLiveUpdate])

  const { entry: resolvedEntry } = useMemo(
    () => resolveEntry(baselineEntry, lockedPersonalizations),
    [baselineEntry, lockedPersonalizations, resolveEntry],
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
