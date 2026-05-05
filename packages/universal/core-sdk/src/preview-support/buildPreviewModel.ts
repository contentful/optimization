import type { SelectedOptimizationArray } from '@contentful/optimization-api-client/api-schemas'
import {
  ALL_VISITORS_AUDIENCE_DESCRIPTION,
  ALL_VISITORS_AUDIENCE_ID,
  ALL_VISITORS_AUDIENCE_NAME,
} from './constants'
import type {
  AudienceDefinition,
  AudienceOverrideState,
  AudienceWithExperiences,
  ExperienceDefinition,
  ExperienceWithState,
} from './definitions'
import type { PreviewSdkSignals } from './signals'
import type { OverrideState } from './types'

/**
 * Inputs for {@link buildPreviewModel}.
 *
 * @public
 */
export interface BuildPreviewModelInput {
  /** Audience definitions from configuration/CMS */
  audienceDefinitions: AudienceDefinition[]
  /** Experience definitions from configuration/CMS */
  experienceDefinitions: ExperienceDefinition[]
  /** Snapshot of SDK signals the preview panel derives from */
  signals: PreviewSdkSignals
  /** Current override state */
  overrides: OverrideState
  /**
   * Pre-override selected-optimizations snapshot used to expose the
   * `naturalVariantIndex` on overridden experiences. Typically sourced from
   * `PreviewOverrideManager.getBaselineSelectedOptimizations()`. When omitted
   * the `naturalVariantIndex` is not surfaced.
   */
  baselineSelectedOptimizations?: Readonly<SelectedOptimizationArray> | null
}

/**
 * Result of {@link buildPreviewModel}.
 *
 * @public
 */
export interface PreviewModel {
  /** Audiences with their associated experiences and computed states */
  audiencesWithExperiences: AudienceWithExperiences[]
  /** Experiences that don't have an associated audience (global experiences) */
  unassociatedExperiences: ExperienceWithState[]
  /** Whether any data is available */
  hasData: boolean
  /** Map of experienceId to variantIndex from SDK selected optimizations */
  sdkVariantIndices: Record<string, number>
}

/** @internal */
function deriveOverrideState(overrides: OverrideState, audienceId: string): AudienceOverrideState {
  const {
    audiences: { [audienceId]: audienceOverride },
  } = overrides
  if (!audienceOverride) return 'default'
  return audienceOverride.isActive ? 'on' : 'off'
}

/** @internal */
function resolveIsActive(overrideState: AudienceOverrideState, naturallyActive: boolean): boolean {
  if (overrideState === 'on') return true
  if (overrideState === 'off') return false
  return naturallyActive
}

/** @internal */
function enrichExperience(
  exp: ExperienceDefinition,
  sdkVariantIndices: Record<string, number>,
  overrides: OverrideState,
  baselineVariantIndices: Record<string, number> | undefined,
): ExperienceWithState {
  const currentVariantIndex = sdkVariantIndices[exp.id] ?? 0
  const isOverridden = overrides.selectedOptimizations[exp.id] !== undefined
  const enriched: ExperienceWithState = {
    ...exp,
    currentVariantIndex,
    isOverridden,
  }
  if (isOverridden && baselineVariantIndices !== undefined) {
    const { [exp.id]: natural } = baselineVariantIndices
    if (natural !== undefined) enriched.naturalVariantIndex = natural
  }
  return enriched
}

/** @internal */
function sortAudiences(audiences: AudienceWithExperiences[]): AudienceWithExperiences[] {
  return [...audiences].sort((a, b) => {
    if (a.audience.id === ALL_VISITORS_AUDIENCE_ID) return -1
    if (b.audience.id === ALL_VISITORS_AUDIENCE_ID) return 1
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
    return a.audience.name.localeCompare(b.audience.name, undefined, { sensitivity: 'base' })
  })
}

/**
 * Combines audience and experience definitions with SDK state to produce
 * a unified, platform-agnostic view of all optimization data, grouped by audience.
 *
 * Experiences without a specific audience — or targeting an audience that isn't in
 * `audienceDefinitions` — are grouped under an "All Visitors" fallback audience.
 *
 * Output ordering is deterministic: All-Visitors first, then qualified audiences
 * before unqualified ones, with alphabetical tie-break by name.
 *
 * @public
 */
export function buildPreviewModel(input: BuildPreviewModelInput): PreviewModel {
  const { audienceDefinitions, experienceDefinitions, signals, overrides } = input
  const { profile, selectedOptimizations } = signals

  const qualifiedAudienceIds = new Set(profile?.audiences ?? [])

  const sdkVariantIndices: Record<string, number> = {}
  if (selectedOptimizations) {
    for (const { experienceId, variantIndex } of selectedOptimizations) {
      sdkVariantIndices[experienceId] = variantIndex
    }
  }

  const baselineVariantIndices: Record<string, number> | undefined =
    input.baselineSelectedOptimizations != null
      ? Object.fromEntries(
          input.baselineSelectedOptimizations.map((s) => [s.experienceId, s.variantIndex]),
        )
      : undefined

  const audienceIds = new Set(audienceDefinitions.map((a) => a.id))
  const unassociatedExperiences: ExperienceWithState[] = experienceDefinitions
    .filter((exp) => !exp.audience?.id || !audienceIds.has(exp.audience.id))
    .map((exp) => enrichExperience(exp, sdkVariantIndices, overrides, baselineVariantIndices))

  const audiencesWithExperiences: AudienceWithExperiences[] = audienceDefinitions.map(
    (audience) => {
      const experiences = experienceDefinitions
        .filter((exp) => exp.audience?.id === audience.id)
        .map((exp) => enrichExperience(exp, sdkVariantIndices, overrides, baselineVariantIndices))
      const isQualified = qualifiedAudienceIds.has(audience.id)
      const overrideState = deriveOverrideState(overrides, audience.id)
      const isActive = resolveIsActive(overrideState, isQualified)
      return { audience, experiences, isQualified, isActive, overrideState }
    },
  )

  if (unassociatedExperiences.length > 0) {
    const allVisitorsAudience: AudienceDefinition = {
      id: ALL_VISITORS_AUDIENCE_ID,
      name: ALL_VISITORS_AUDIENCE_NAME,
      description: ALL_VISITORS_AUDIENCE_DESCRIPTION,
    }
    const overrideState = deriveOverrideState(overrides, ALL_VISITORS_AUDIENCE_ID)
    audiencesWithExperiences.push({
      audience: allVisitorsAudience,
      experiences: unassociatedExperiences,
      isQualified: true,
      isActive: resolveIsActive(overrideState, true),
      overrideState,
    })
  }

  const hasData = audienceDefinitions.length > 0 || experienceDefinitions.length > 0

  return {
    audiencesWithExperiences: sortAudiences(audiencesWithExperiences),
    unassociatedExperiences,
    hasData,
    sdkVariantIndices,
  }
}
