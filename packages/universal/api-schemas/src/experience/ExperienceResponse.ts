import * as z from 'zod/mini'
import { ChangeArray } from './change'
import { SelectedOptimizationArray } from './optimization'
import { Profile } from './profile'
import { ResponseEnvelope } from './ResponseEnvelope'

/**
 * Zod schema describing the `data` payload of a standard Experience API response.
 *
 * @remarks
 * Contains the evaluated profile, selected optimizations, and computed
 * changes that should be applied on the client.
 *
 * @public
 */
export const ExperienceData = z.object({
  /**
   * Profile associated with the evaluated events.
   */
  profile: Profile,

  /**
   * Selected experiences and variants for the profile.
   *
   * @see {@link SelectedOptimizationArray}
   */
  experiences: SelectedOptimizationArray,

  /**
   * Currently used for Custom Flags.
   *
   * @see {@link ChangeArray}
   */
  changes: ChangeArray,
})

/**
 * TypeScript type inferred from {@link ExperienceData}.
 *
 * @public
 */
export type ExperienceData = z.infer<typeof ExperienceData>

/**
 * Zod schema describing a full Experience API response.
 *
 * @remarks
 * Extends {@link ResponseEnvelope} with {@link ExperienceData} as the `data` payload.
 *
 * @public
 */
export const ExperienceResponse = z.extend(ResponseEnvelope, { data: ExperienceData })

/**
 * TypeScript type inferred from {@link ExperienceResponse}.
 *
 * @public
 */
export type ExperienceResponse = z.infer<typeof ExperienceResponse>

/**
 * Optimization data shape used for compatibility outside the API adapter.
 *
 * @remarks
 * This type mirrors {@link ExperienceData} but replaces the `experiences`
 * field with `selectedOptimizations` while preserving the rest of the structure.
 *
 * @public
 */
export type OptimizationData = Omit<ExperienceData, 'experiences'> & {
  /**
   * Selected optimizations for the profile.
   */
  selectedOptimizations: SelectedOptimizationArray
}
