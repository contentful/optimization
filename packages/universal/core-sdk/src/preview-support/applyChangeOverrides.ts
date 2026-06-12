import type {
  ChangeArray,
  InlineVariableComponent,
  OptimizationEntry,
} from '@contentful/optimization-api-client/api-schemas'
import { isInlineVariableComponent } from '@contentful/optimization-api-client/api-schemas'
import type { OptimizationOverride } from './types'

function getInlineVariableComponents(optimization: OptimizationEntry): InlineVariableComponent[] {
  const { components } = optimization.fields.nt_config ?? {}
  return Array.isArray(components) ? components.filter(isInlineVariableComponent) : []
}

/**
 * Merges user-selected variant overrides into the given custom-flag changes.
 *
 * For every overridden experience, any `InlineVariable` components are converted
 * into `Variable` changes so the runtime flag APIs resolve the selected preview
 * value from `changes`. This keeps `getFlag()` consumers in sync with manual
 * variant picks made in a preview panel.
 *
 * @param changes - Current array of custom-flag changes (the un-overridden API baseline).
 * @param optimizationEntries - Available optimization entries indexed for preview.
 * @param overrides - Map of experience ID to the desired override.
 * @returns A new array with inline-variable change overrides applied, or the original array when no overrides exist.
 *
 * @public
 */
export function applyChangeOverrides(
  changes: ChangeArray,
  optimizationEntries: readonly OptimizationEntry[],
  overrides: Record<string, OptimizationOverride>,
): ChangeArray {
  const overrideValues = Object.values(overrides)
  if (overrideValues.length === 0) return changes

  const overrideChanges = optimizationEntries.flatMap((optimization): ChangeArray => {
    const {
      fields: { nt_experience_id: experienceId },
    } = optimization
    const { [experienceId]: override } = overrides
    if (override === undefined) return []

    const { variantIndex } = override

    return getInlineVariableComponents(optimization).map((component): ChangeArray[number] => ({
      key: component.key,
      type: 'Variable',
      value:
        variantIndex === 0
          ? component.baseline.value
          : (component.variants[variantIndex - 1]?.value ?? component.baseline.value),
      meta: {
        experienceId,
        variantIndex,
      },
    }))
  })

  if (overrideChanges.length === 0) return changes

  return [
    ...changes.filter(
      (change) =>
        !overrideChanges.some(
          ({ key, meta: { experienceId } }) =>
            change.key === key && change.meta.experienceId === experienceId,
        ),
    ),
    ...overrideChanges,
  ]
}
