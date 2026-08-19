import type { Entry } from 'contentful'

const OPTIMIZED_ENTRY_LOADING_CONTENT_TYPE_ID = 'contentful-loading-entry'

/**
 * Return whether a Contentful entry contains optimization references.
 *
 * @public
 */
export function hasOptimizationReferences(entry: Entry): boolean {
  return Array.isArray(entry.fields.nt_experiences) && entry.fields.nt_experiences.length > 0
}

/**
 * Resolve whether an optimized entry should react to later SDK state updates.
 *
 * @public
 */
export function resolveShouldLiveUpdate(params: {
  readonly entryLiveUpdatesEnabled: boolean | undefined
  readonly rootLiveUpdatesEnabled: boolean
  readonly isPreviewPanelOpen: boolean
}): boolean {
  const { entryLiveUpdatesEnabled, rootLiveUpdatesEnabled, isPreviewPanelOpen } = params

  if (isPreviewPanelOpen) {
    return true
  }

  return entryLiveUpdatesEnabled ?? rootLiveUpdatesEnabled
}

export function isExperienceRequestSettled(status: string): boolean {
  return status === 'success' || status === 'failed'
}

export function isOptimizedEntryLoadingEntry(entry: Entry): boolean {
  return entry.sys.contentType.sys.id === OPTIMIZED_ENTRY_LOADING_CONTENT_TYPE_ID
}

export function didSdkPresentationEnd(
  hadSdk: boolean,
  sdkChanged: boolean,
  wasReady: boolean,
  isReady: boolean,
): boolean {
  return (hadSdk && sdkChanged) || (wasReady && !isReady)
}

export function shouldResubscribe(
  sdkChanged: boolean,
  sdkStateReadyChanged: boolean,
  liveUpdateChanged: boolean,
): boolean {
  return sdkChanged || sdkStateReadyChanged || liveUpdateChanged
}
