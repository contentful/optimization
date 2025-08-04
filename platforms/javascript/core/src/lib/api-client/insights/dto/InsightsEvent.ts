import * as z from 'zod/mini'

export const InsightsEvent = z.object({})
export type InsightsEvent = z.infer<typeof InsightsEvent>
