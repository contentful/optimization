import { signals } from '@contentful/optimization-core'
import {
  type AudienceDefinition,
  type ExperienceDefinition,
  type OverrideState,
  type PreviewOverrideManager,
  buildPreviewModel,
} from '@contentful/optimization-core/preview-support'

export type BaselineSelections = ReturnType<
  PreviewOverrideManager['getBaselineSelectedOptimizations']
>

export interface TransformedOverrides {
  audienceOverrides: Record<string, boolean>
  variantOverrides: Record<string, number>
  defaultVariantIndices: Record<string, number>
}

export interface PreviewModelDeps {
  audienceDefinitions: AudienceDefinition[] | null
  experienceDefinitions: ExperienceDefinition[] | null
  audienceNameMap: Record<string, string>
  experienceNameMap: Record<string, string>
}

// Transform internal override state into the flat Record<string, primitive>
// shapes the native preview panel expects.
export function transformOverrides(
  overrides: OverrideState,
  baseline: BaselineSelections,
): TransformedOverrides {
  const audienceOverrides = Object.fromEntries(
    Object.entries(overrides.audiences).map(([id, { isActive }]) => [id, isActive]),
  )
  const variantOverrides = Object.fromEntries(
    Object.entries(overrides.selectedOptimizations).map(([id, { variantIndex }]) => [
      id,
      variantIndex,
    ]),
  )
  const defaultVariantIndices = Object.fromEntries(
    (baseline ?? [])
      .filter(({ experienceId }) => variantOverrides[experienceId] !== undefined)
      .map(({ experienceId, variantIndex }) => [experienceId, variantIndex]),
  )

  return { audienceOverrides, variantOverrides, defaultVariantIndices }
}

export type PreviewModel = ReturnType<typeof buildPreviewModel> & {
  audienceNameMap: Record<string, string>
  experienceNameMap: Record<string, string>
}

// Build the pre-baked UI model when host has loaded definitions. Returns null
// when `loadDefinitions()` has not yet been called — iOS renders an empty state.
export function computePreviewModel(
  deps: PreviewModelDeps,
  overrides: OverrideState,
  baseline: BaselineSelections,
): PreviewModel | null {
  const { audienceDefinitions, experienceDefinitions, audienceNameMap, experienceNameMap } = deps
  if (!audienceDefinitions || !experienceDefinitions) return null
  return {
    ...buildPreviewModel({
      audienceDefinitions,
      experienceDefinitions,
      signals: {
        profile: signals.profile.value,
        selectedOptimizations: signals.selectedOptimizations.value,
        consent: signals.consent.value,
        isLoading: false,
      },
      overrides,
      baselineSelectedOptimizations: baseline,
    }),
    audienceNameMap,
    experienceNameMap,
  }
}
