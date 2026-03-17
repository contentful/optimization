import { useOptimization } from '../hooks/useOptimization'
import type { PersonalizationEntryInput } from '../types'

export interface UsePersonalizationResult {
  readonly resolveEntry: (entry: PersonalizationEntryInput) => PersonalizationEntryInput
}

export function usePersonalization(): UsePersonalizationResult {
  const { sdk, isReady } = useOptimization()

  return {
    resolveEntry: (entry: PersonalizationEntryInput): PersonalizationEntryInput => {
      if (!isReady || sdk === undefined) {
        return entry
      }

      return sdk.personalizeEntry(entry, sdk.states.selectedPersonalizations.current).entry
    },
  }
}
