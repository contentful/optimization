import { array, discriminatedUnion, type infer as zInfer } from 'zod/mini'
import { ComponentViewEvent } from '../../../experience/dto/event'

export const InsightsEvent = discriminatedUnion('type', [ComponentViewEvent])
export type InsightsEvent = zInfer<typeof InsightsEvent>

export const InsightsEventArray = array(InsightsEvent)
export type InsightsEventArray = zInfer<typeof InsightsEventArray>
