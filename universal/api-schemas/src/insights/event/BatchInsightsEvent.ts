import * as z from 'zod/mini'
import { Profile } from '../../experience/profile'
import { InsightsEventArray } from './InsightsEvent'

export const BatchInsightsEvent = z.object({
  profile: Profile,
  events: InsightsEventArray,
})
export type BatchInsightsEvent = z.infer<typeof BatchInsightsEvent>

export const BatchInsightsEventArray = z.array(BatchInsightsEvent)
export type BatchInsightsEventArray = z.infer<typeof BatchInsightsEventArray>
