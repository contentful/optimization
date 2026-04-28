/**
 * Optimization Preview SDK — cross-platform preview-panel toolkit.
 *
 * Provides platform-agnostic preview functionality: override management,
 * preview-model building, and Contentful entry mapping. Consumed by the
 * React Native SDK, the iOS JS bridge, and (eventually) the web preview
 * panel UI.
 *
 * @packageDocumentation
 */

export { applyOptimizationOverrides } from './applyOptimizationOverrides'
export {
  buildPreviewModel,
  type BuildPreviewModelInput,
  type PreviewModel,
} from './buildPreviewModel'
export {
  ALL_VISITORS_AUDIENCE_DESCRIPTION,
  ALL_VISITORS_AUDIENCE_ID,
  ALL_VISITORS_AUDIENCE_NAME,
} from './constants'
export { fetchAllEntriesByContentType, fetchAudienceAndExperienceEntries } from './contentfulFetch'
export type {
  AudienceDefinition,
  AudienceOverrideState,
  AudienceWithExperiences,
  ContentfulClient,
  ContentfulEntry,
  ContentfulEntryCollection,
  ExperienceDefinition,
  ExperienceWithState,
  PreviewData,
  VariantDistribution,
} from './definitions'
export {
  createAudienceDefinitions,
  createExperienceDefinitions,
  createExperienceNameMap,
} from './entryMappers'
export { PreviewOverrideManager, type PreviewOverrideManagerConfig } from './PreviewOverrideManager'
export type { PreviewSdkSignals } from './signals'
export type { AudienceOverride, OptimizationOverride, OverrideState } from './types'
