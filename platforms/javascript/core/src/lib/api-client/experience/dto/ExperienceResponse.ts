import { z } from 'zod/mini'
import { ChangeArray } from './change'
import { Profile } from './profile'
import { ResponseEnvelope } from './ResponseEnvelope'
import { SelectedVariantArray } from './variant'

export const ExperienceData = z.object({
  profile: Profile,
  experiences: SelectedVariantArray,
  changes: ChangeArray,
})
export type ExperienceData = z.infer<typeof ExperienceData>

export const ExperienceResponse = z.extend(ResponseEnvelope, { data: ExperienceData })
export type ExperienceResponse = z.infer<typeof ExperienceResponse>

/** This type is specifically for compatibility outside the API adapter */
export type OptimizationData = Omit<ExperienceData, 'experiences'> & {
  variants: SelectedVariantArray
}
