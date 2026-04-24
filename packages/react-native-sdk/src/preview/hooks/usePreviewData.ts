import { buildPreviewModel, type PreviewModel } from '@contentful/optimization-preview'
import { useMemo } from 'react'
import type {
  AudienceDefinition,
  ExperienceDefinition,
  OverrideState,
  PreviewState,
} from '../types'

interface UsePreviewDataParams {
  /** Audience definitions from configuration/CMS */
  audienceDefinitions: AudienceDefinition[]
  /** Experience definitions from configuration/CMS */
  experienceDefinitions: ExperienceDefinition[]
  /** Current preview state from SDK */
  previewState: PreviewState
  /** Current override state */
  overrides: OverrideState
}

/**
 * Combines audience and experience definitions with SDK state to produce
 * a unified view of all optimization data, grouped by audience.
 *
 * Thin React wrapper around `buildPreviewModel` from `@contentful/optimization-preview`.
 *
 * @internal
 */
export function usePreviewData({
  audienceDefinitions,
  experienceDefinitions,
  previewState,
  overrides,
}: UsePreviewDataParams): PreviewModel {
  return useMemo(
    () =>
      buildPreviewModel({
        audienceDefinitions,
        experienceDefinitions,
        signals: previewState,
        overrides,
      }),
    [audienceDefinitions, experienceDefinitions, previewState, overrides],
  )
}

export default usePreviewData
