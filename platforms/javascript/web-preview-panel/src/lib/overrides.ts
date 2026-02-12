import type { SelectedPersonalizationArray } from '@contentful/optimization-web'

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
