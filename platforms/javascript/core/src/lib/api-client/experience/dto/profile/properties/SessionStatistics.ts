import { boolean, number, object, string, type infer as zInfer } from 'zod/mini'
import { Page } from '../../event/properties'

export const SessionStatistics = object({
  id: string(),
  isReturningVisitor: boolean(),
  landingPage: Page,
  count: number(),
  activeSessionLength: number(),
  averageSessionLength: number(),
})
export type SessionStatisticsType = zInfer<typeof SessionStatistics>
