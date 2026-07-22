import type {
  EntryReplacementComponent,
  OptimizationEntry,
  SelectedOptimization,
  SelectedOptimizationArray,
} from '@contentful/optimization-api-client/api-schemas'
import {
  isEntryReplacementComponent,
  normalizeOptimizationConfig,
} from '@contentful/optimization-api-client/api-schemas'
import type { OptimizationOverride } from './types'

/**
 * Synthesise the `variants` map (baseline entry ID → variant entry ID) an XP
 * response would carry for the given forced variant. Rules:
 *
 * - `variantIndex === 0` → no key emitted for the baseline. The resolver's
 *   cf-entities short-circuit falls through to baseline when the map has no
 *   entry for a baseline id (distinct from `''`, which means "empty variant —
 *   render nothing").
 * - Out-of-range index → treated as an empty variant per component (`''`).
 * - Picked variant `hidden: true` → empty variant per component (`''`).
 * - Otherwise → `{ [baseline.id]: variants[index-1].id }`.
 *
 * Mirrors what XP's `ExperienceVariantSelector.getBaselineVariantMappings` emits
 * server-side so the preview render path is identical to the live one.
 *
 * @internal
 */
function synthesiseVariantsMap(
  optimizationEntry: OptimizationEntry,
  variantIndex: number,
): Record<string, string> {
  const { components } = normalizeOptimizationConfig(optimizationEntry.fields.nt_config)
  const entries: Array<[string, string]> = []

  for (const component of components) {
    if (!isEntryReplacementComponent(component)) continue
    const entryReplacement: EntryReplacementComponent = component
    const {
      baseline: { id: baselineId },
    } = entryReplacement
    if (baselineId === '') continue

    // variantIndex 0 → baseline: omit the key so the resolver falls through
    // to baseline rendering. Emitting '' would trigger the empty-variant
    // (render-nothing) path instead.
    if (variantIndex === 0) continue

    const picked = entryReplacement.variants.at(variantIndex - 1)
    if (!picked || picked.hidden === true) {
      entries.push([baselineId, ''])
      continue
    }

    entries.push([baselineId, picked.id])
  }

  return Object.fromEntries(entries)
}

/**
 * Merges user-selected variant overrides into the given selected optimizations.
 *
 * Existing entries whose experience ID appears in the overrides map have their
 * `variantIndex` replaced. When `optimizationEntries` is provided, each override
 * also gets a synthesised `variants` map so the cf-entities render-path
 * short-circuit picks the forced variant exactly the way an XP response would.
 * Override entries not already present in the array are appended.
 *
 * @param apiSelectedOptimizations - Current array of selected optimizations (from API baseline).
 * @param overrides - Map of experience ID to the desired override.
 * @param optimizationEntries - Optional optimization entries providing `nt_config.components` for variant-map synthesis.
 * @returns A new array with overrides applied, or the original array when no overrides exist.
 *
 * @public
 */
export function applyOptimizationOverrides(
  apiSelectedOptimizations: SelectedOptimizationArray,
  overrides: Record<string, OptimizationOverride>,
  optimizationEntries?: readonly OptimizationEntry[],
): SelectedOptimizationArray {
  const overrideEntries = Object.values(overrides)
  if (overrideEntries.length === 0) return apiSelectedOptimizations

  const entryByExperienceId = new Map<string, OptimizationEntry>()
  for (const entry of optimizationEntries ?? []) {
    entryByExperienceId.set(entry.fields.nt_experience_id, entry)
  }

  const resolveVariants = (
    experienceId: string,
    variantIndex: number,
    fallback: Record<string, string>,
  ): Record<string, string> => {
    const optimizationEntry = entryByExperienceId.get(experienceId)
    if (!optimizationEntry) return fallback
    return synthesiseVariantsMap(optimizationEntry, variantIndex)
  }

  const overridden = apiSelectedOptimizations.map<SelectedOptimization>((selectedOptimization) => {
    const { [selectedOptimization.experienceId]: override } = overrides
    if (!override) return selectedOptimization
    return {
      ...selectedOptimization,
      variantIndex: override.variantIndex,
      variants: resolveVariants(
        selectedOptimization.experienceId,
        override.variantIndex,
        selectedOptimization.variants,
      ),
    }
  })

  for (const override of overrideEntries) {
    if (!overridden.some((selected) => selected.experienceId === override.experienceId)) {
      overridden.push({
        experienceId: override.experienceId,
        variantIndex: override.variantIndex,
        variants: resolveVariants(override.experienceId, override.variantIndex, {}),
      })
    }
  }

  return overridden
}
