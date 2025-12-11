import * as z from 'zod/mini'
import { ChangeArray } from './change'
import { SelectedPersonalizationArray } from './personalization'
import { Profile } from './profile'
import { ResponseEnvelope } from './ResponseEnvelope'

/**
 * Zod schema describing the `data` payload of a standard Experience API response.
 *
 * @remarks
 * Contains the evaluated profile, selected personalizations, and computed
 * changes that should be applied on the client.
 */
export const ExperienceData = z.object({
  /**
   * Profile associated with the evaluated events.
   */
  profile: Profile,

  /**
   * Selected experiences and variants for the profile.
   *
   * @see {@link SelectedPersonalizationArray}
   */
  experiences: SelectedPersonalizationArray,

  /**
   * Currently used for Custom Flags.
   *
   * @see {@link ChangeArray}
   */
  changes: ChangeArray,
})

/**
 * TypeScript type inferred from {@link ExperienceData}.
 */
export type ExperienceData = z.infer<typeof ExperienceData>

/**
 * Zod schema describing a full Experience API response.
 *
 * @remarks
 * Extends {@link ResponseEnvelope} with {@link ExperienceData} as the `data` payload.
 */
export const ExperienceResponse = z.extend(ResponseEnvelope, { data: ExperienceData })

/**
 * TypeScript type inferred from {@link ExperienceResponse}.
 */
export type ExperienceResponse = z.infer<typeof ExperienceResponse>

/**
 * Optimization data shape used for compatibility outside the API adapter.
 *
 * @remarks
 * This type mirrors {@link ExperienceData} but replaces the `experiences`
 * field with `personalizations` while preserving the rest of the structure.
 */
export type OptimizationData = Omit<ExperienceData, 'experiences'> & {
  /**
   * Selected personalizations for the profile.
   */
  personalizations: SelectedPersonalizationArray
}
