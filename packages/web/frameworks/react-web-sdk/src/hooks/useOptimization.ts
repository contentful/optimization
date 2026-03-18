import type { SelectedPersonalizationArray } from '@contentful/optimization-web/api-schemas'
import type { ResolvedData } from '@contentful/optimization-web/core-sdk'
import type { Entry, EntrySkeletonType } from 'contentful'
import { useContext, useMemo } from 'react'

import { OptimizationContext, type OptimizationContextValue } from '../context/OptimizationContext'
import type { OptimizationSdk } from '../types'

function getMissingProviderError(): Error {
  return new Error(
    'useOptimization must be used within an OptimizationProvider. ' +
      'Make sure to wrap your component tree with <OptimizationRoot clientId="your-client-id">.',
  )
}

export function useOptimizationContext(): OptimizationContextValue {
  const context = useContext(OptimizationContext)

  if (!context) {
    throw getMissingProviderError()
  }

  return context
}

export interface UseOptimizationResult extends OptimizationSdk {
  readonly resolveEntry: (
    entry: Entry,
    selectedPersonalizations?: SelectedPersonalizationArray,
  ) => Entry
  readonly resolveEntryData: (
    entry: Entry,
    selectedPersonalizations?: SelectedPersonalizationArray,
  ) => ResolvedData<EntrySkeletonType>
  readonly sdk: OptimizationSdk
}

function resolveEntryData(
  sdk: OptimizationSdk,
  entry: Entry,
  selectedPersonalizations = sdk.states.selectedPersonalizations.current,
): ResolvedData<EntrySkeletonType> {
  return sdk.personalizeEntry(entry, selectedPersonalizations)
}

export function useOptimization(): UseOptimizationResult {
  const { sdk, isReady, error } = useOptimizationContext()

  if (!sdk || !isReady) {
    if (error) {
      throw new Error(`ContentfulOptimization SDK failed to initialize: ${error.message}`, {
        cause: error,
      })
    }

    throw new Error(
      'ContentfulOptimization SDK is still initializing. ' +
        'This should not happen when using the loading gate in OptimizationProvider.',
    )
  }

  return useMemo(
    () => ({
      sdk,
      consent: (value) => {
        sdk.consent(value)
      },
      destroy: () => {
        sdk.destroy()
      },
      getFlag: (name, changes) => sdk.getFlag(name, changes),
      getMergeTagValue: (embeddedEntryNodeTarget, profile) =>
        sdk.getMergeTagValue(embeddedEntryNodeTarget, profile),
      identify: async (payload) => await sdk.identify(payload),
      page: async (payload) => await sdk.page(payload),
      personalizeEntry: (entry, selectedPersonalizations) =>
        sdk.personalizeEntry(entry, selectedPersonalizations),
      reset: () => {
        sdk.reset()
      },
      resolveEntry: (entry, selectedPersonalizations) =>
        resolveEntryData(sdk, entry, selectedPersonalizations).entry,
      resolveEntryData: (entry, selectedPersonalizations) =>
        resolveEntryData(sdk, entry, selectedPersonalizations),
      states: sdk.states,
      tracking: sdk.tracking,
      track: async (payload) => await sdk.track(payload),
      trackClick: async (payload) => {
        await sdk.trackClick(payload)
      },
      trackView: async (payload) => await sdk.trackView(payload),
    }),
    [sdk],
  )
}
