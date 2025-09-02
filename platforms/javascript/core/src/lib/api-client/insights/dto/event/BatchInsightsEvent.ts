import { array, object, type infer as zInfer } from 'zod/mini'
import { Profile } from '../../../experience/dto/profile'
import { InsightsEventArray } from './InsightsEvent'

export const BatchInsightsEvent = object({
  profile: Profile,
  events: InsightsEventArray,
})
export type BatchInsightsEvent = zInfer<typeof BatchInsightsEvent>

export const BatchInsightsEventArray = array(BatchInsightsEvent)
export type BatchInsightsEventArray = zInfer<typeof BatchInsightsEventArray>
