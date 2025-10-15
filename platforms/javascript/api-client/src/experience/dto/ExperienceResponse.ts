import { z } from 'zod/mini'
import { ChangeArray } from './change'
import { SelectedPersonalizationArray } from './personalization'
import { Profile } from './profile'
import { ResponseEnvelope } from './ResponseEnvelope'

export const ExperienceData = z.object({
  profile: Profile,
  experiences: SelectedPersonalizationArray,
  changes: ChangeArray,
})
export type ExperienceData = z.infer<typeof ExperienceData>

export const ExperienceResponse = z.extend(ResponseEnvelope, { data: ExperienceData })
export type ExperienceResponse = z.infer<typeof ExperienceResponse>

/** This type is specifically for compatibility outside the API adapter */
export type OptimizationData = Omit<ExperienceData, 'experiences'> & {
  personalizations: SelectedPersonalizationArray
}
