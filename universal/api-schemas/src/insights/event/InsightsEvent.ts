import * as z from 'zod/mini'
import { ComponentViewEvent } from '../../experience/event'

/**
 * Zod schema describing an Insights event.
 *
 * @remarks
 * Currently, Insights events are limited to {@link ComponentViewEvent},
 * but this discriminated union can be extended with additional event
 * types in the future.
 */
export const InsightsEvent = z.discriminatedUnion('type', [ComponentViewEvent])

/**
 * TypeScript type inferred from {@link InsightsEvent}.
 */
export type InsightsEvent = z.infer<typeof InsightsEvent>

/**
 * Union of all possible `type` values for {@link InsightsEvent}.
 */
export type InsightsEventType = InsightsEvent['type']

/**
 * Zod schema describing an array of {@link InsightsEvent} items.
 */
export const InsightsEventArray = z.array(InsightsEvent)

/**
 * TypeScript type inferred from {@link InsightsEventArray}.
 */
export type InsightsEventArray = z.infer<typeof InsightsEventArray>
