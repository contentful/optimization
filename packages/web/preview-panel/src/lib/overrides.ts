import type { SelectedPersonalizationArray } from '@contentful/optimization-web/api-schemas'

/**
 * Merges user-selected variant overrides into the given selected personalizations.
 *
 * Existing entries whose experience ID appears in the overrides map have their
 * `variantIndex` replaced. Override entries not already present in the array
 * are appended.
 *
 * @param selectedPersonalizations - Current array of selected personalizations.
 * @param overrides - Map of experience ID to the desired variant index.
 * @returns A new array with overrides applied, or the original array when no overrides exist.
 *
 * @example
 * ```ts
 * const result = applyPersonalizationOverrides(selectedPersonalizations, overrides)
 * ```
 *
 * @public
 */
export function applyPersonalizationOverrides(
  selectedPersonalizations: SelectedPersonalizationArray,
  overrides: Map<string, number>,
): SelectedPersonalizationArray {
  // Clone only if overrides exist
  if (overrides.size === 0) return selectedPersonalizations

  const overridden = selectedPersonalizations.map((selected) => {
    const overrideIndex = overrides.get(selected.experienceId)
    return overrideIndex !== undefined ? { ...selected, variantIndex: overrideIndex } : selected
  })

  // Add new overrides not present in selectedPersonalizations
  for (const [experienceId, variantIndex] of overrides) {
    if (!overridden.some((sel) => sel.experienceId === experienceId)) {
      overridden.push({ experienceId, variantIndex, variants: {} })
    }
  }

  return overridden
}
