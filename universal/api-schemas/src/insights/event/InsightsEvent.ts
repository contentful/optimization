import * as z from 'zod/mini'
import { ComponentViewEvent } from '../../experience/event'
import { ComponentClickEvent } from './ComponentClickEvent'
import { ComponentHoverEvent } from './ComponentHoverEvent'

/**
 * Zod schema describing an Insights event.
 *
 * @remarks
 * Insights events currently include {@link ComponentViewEvent},
 * {@link ComponentClickEvent}, and {@link ComponentHoverEvent}.
 *
 * @public
 */
export const InsightsEvent = z.discriminatedUnion('type', [
  ComponentViewEvent,
  ComponentClickEvent,
  ComponentHoverEvent,
])

/**
 * TypeScript type inferred from {@link InsightsEvent}.
 *
 * @public
 */
export type InsightsEvent = z.infer<typeof InsightsEvent>

/**
 * Union of all possible `type` values for {@link InsightsEvent}.
 *
 * @public
 */
export type InsightsEventType = InsightsEvent['type']

/**
 * Zod schema describing an array of {@link InsightsEvent} items.
 *
 * @public
 */
export const InsightsEventArray = z.array(InsightsEvent)

/**
 * TypeScript type inferred from {@link InsightsEventArray}.
 *
 * @public
 */
export type InsightsEventArray = z.infer<typeof InsightsEventArray>
