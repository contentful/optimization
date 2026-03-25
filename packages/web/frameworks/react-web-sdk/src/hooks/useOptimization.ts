import type { SelectedPersonalizationArray } from '@contentful/optimization-web/api-schemas'
import type { ResolvedData } from '@contentful/optimization-web/core-sdk'
import type { Entry, EntrySkeletonType } from 'contentful'
import { useContext, useMemo } from 'react'

import {
  OptimizationContext,
  type OptimizationContextValue,
  type OptimizationSdk,
} from '../context/OptimizationContext'

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

export interface UseOptimizationResult {
  readonly consent: OptimizationSdk['consent']
  readonly getFlag: OptimizationSdk['getFlag']
  readonly getMergeTagValue: OptimizationSdk['getMergeTagValue']
  readonly identify: OptimizationSdk['identify']
  readonly interactionTracking: OptimizationSdk['tracking']
  readonly page: OptimizationSdk['page']
  readonly resolveOptimizedEntry: OptimizationSdk['resolveOptimizedEntry']
  readonly resolveEntry: (
    entry: Entry,
    selectedPersonalizations?: SelectedPersonalizationArray,
  ) => Entry
  readonly resolveEntryData: (
    entry: Entry,
    selectedPersonalizations?: SelectedPersonalizationArray,
  ) => ResolvedData<EntrySkeletonType>
  readonly sdk: OptimizationSdk
  readonly track: OptimizationSdk['track']
}

function resolveEntryData(
  sdk: OptimizationSdk,
  entry: Entry,
  selectedPersonalizations = sdk.states.selectedPersonalizations.current,
): ResolvedData<EntrySkeletonType> {
  return sdk.resolveOptimizedEntry(entry, selectedPersonalizations)
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
      getFlag: (name, changes) => sdk.getFlag(name, changes),
      getMergeTagValue: (embeddedEntryNodeTarget, profile) =>
        sdk.getMergeTagValue(embeddedEntryNodeTarget, profile),
      identify: async (payload) => await sdk.identify(payload),
      interactionTracking: sdk.tracking,
      page: async (payload) => await sdk.page(payload),
      resolveOptimizedEntry: (
        entry: Entry,
        selectedPersonalizations?: SelectedPersonalizationArray,
      ) => sdk.resolveOptimizedEntry(entry, selectedPersonalizations),
      resolveEntry: (entry, selectedPersonalizations) =>
        resolveEntryData(sdk, entry, selectedPersonalizations).entry,
      resolveEntryData: (entry, selectedPersonalizations) =>
        resolveEntryData(sdk, entry, selectedPersonalizations),
      track: async (payload) => await sdk.track(payload),
    }),
    [sdk],
  )
}
