import { z } from 'zod/mini'
import { ComponentViewEvent } from '../../experience/event'

export const InsightsEvent = z.discriminatedUnion('type', [ComponentViewEvent])
export type InsightsEvent = z.infer<typeof InsightsEvent>

export const InsightsEventArray = z.array(InsightsEvent)
export type InsightsEventArray = z.infer<typeof InsightsEventArray>
