import type { SelectedOptimizationArray } from '@contentful/optimization-api-client/api-schemas'
import type { OptimizationOverride } from './types'

/**
 * Merges user-selected variant overrides into the given selected optimizations.
 *
 * Existing entries whose experience ID appears in the overrides map have their
 * `variantIndex` replaced. Override entries not already present in the array
 * are appended with an empty `variants` map.
 *
 * @param apiSelectedOptimizations - Current array of selected optimizations (from API baseline).
 * @param overrides - Map of experience ID to the desired override.
 * @returns A new array with overrides applied, or the original array when no overrides exist.
 *
 * @public
 */
export function applyOptimizationOverrides(
  apiSelectedOptimizations: SelectedOptimizationArray,
  overrides: Record<string, OptimizationOverride>,
): SelectedOptimizationArray {
  const overrideEntries = Object.values(overrides)
  if (overrideEntries.length === 0) return apiSelectedOptimizations

  const overridden = apiSelectedOptimizations.map((selectedOptimization) => {
    const { [selectedOptimization.experienceId]: override } = overrides
    if (override) {
      return {
        ...selectedOptimization,
        variantIndex: override.variantIndex,
      }
    }
    return selectedOptimization
  })

  for (const override of overrideEntries) {
    if (!overridden.some((selected) => selected.experienceId === override.experienceId)) {
      overridden.push({
        experienceId: override.experienceId,
        variantIndex: override.variantIndex,
        variants: {},
      })
    }
  }

  return overridden
}
