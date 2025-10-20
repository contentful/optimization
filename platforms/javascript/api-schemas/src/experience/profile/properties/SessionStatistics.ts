import { z } from 'zod/mini'
import { Page } from '../../event/properties'

export const SessionStatistics = z.object({
  id: z.string(),
  isReturningVisitor: z.boolean(),
  landingPage: Page,
  count: z.number(),
  activeSessionLength: z.number(),
  averageSessionLength: z.number(),
})
export type SessionStatistics = z.infer<typeof SessionStatistics>
