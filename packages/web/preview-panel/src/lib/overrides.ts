import type {
  ChangeArray,
  InlineVariableComponent,
  OptimizationEntry,
} from '@contentful/optimization-web/api-schemas'
import { isInlineVariableComponent } from './schemaGuards'

function getInlineVariableComponents(optimization: OptimizationEntry): InlineVariableComponent[] {
  const { components } = optimization.fields.nt_config ?? {}
  return Array.isArray(components) ? components.filter(isInlineVariableComponent) : []
}

/**
 * Merges user-selected variant overrides into the given custom-flag changes.
 *
 * For every overridden experience, any `InlineVariable` components are converted
 * into `Variable` changes so the runtime flag APIs resolve the selected preview
 * value from `changes`.
 *
 * @param changes - Current array of custom-flag changes.
 * @param optimizationEntries - Available optimization entries indexed for preview.
 * @param overrides - Map of experience ID to the desired variant index.
 * @returns A new array with inline-variable change overrides applied, or the original array when no overrides exist.
 *
 * @public
 */
export function applyChangeOverrides(
  changes: ChangeArray,
  optimizationEntries: OptimizationEntry[],
  overrides: Map<string, number>,
): ChangeArray {
  if (overrides.size === 0) return changes

  const overrideChanges = optimizationEntries.flatMap((optimization): ChangeArray => {
    const {
      fields: { nt_experience_id: experienceId },
    } = optimization
    const variantIndex = overrides.get(experienceId)

    if (variantIndex === undefined) return []

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
