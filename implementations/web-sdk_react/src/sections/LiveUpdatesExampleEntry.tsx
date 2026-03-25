import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import { type JSX, useEffect, useMemo, useState } from 'react'
import { useOptimization } from '../optimization/hooks/useOptimization'
import { useOptimizationResolver } from '../optimization/hooks/useOptimizationResolver'
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
  const { resolveEntry } = useOptimizationResolver()
  const liveUpdatesContext = useLiveUpdates()
  const [lockedSelectedOptimizations, setLockedSelectedOptimizations] = useState<
    SelectedOptimizationArray | undefined
  >(undefined)

  const shouldLiveUpdate =
    liveUpdatesContext?.previewPanelVisible === true ||
    (liveUpdates ?? liveUpdatesContext?.globalLiveUpdates ?? false)

  useEffect(() => {
    if (!isReady || sdk === undefined) {
      setLockedSelectedOptimizations(undefined)
      return
    }

    const subscription = sdk.states.selectedOptimizations.subscribe((nextSelectedOptimizations) => {
      if (shouldLiveUpdate) {
        setLockedSelectedOptimizations(nextSelectedOptimizations)
        return
      }

      setLockedSelectedOptimizations((currentSelectedOptimizations) => {
        if (currentSelectedOptimizations === undefined && nextSelectedOptimizations !== undefined) {
          return nextSelectedOptimizations
        }

        return currentSelectedOptimizations
      })
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [isReady, sdk, shouldLiveUpdate])

  const { entry: resolvedEntry } = useMemo(
    () => resolveEntry(baselineEntry, lockedSelectedOptimizations),
    [baselineEntry, lockedSelectedOptimizations, resolveEntry],
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
