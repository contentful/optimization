import * as z from 'zod/mini'
import { ViewEvent } from '../../experience/event'
import { ClickEvent } from './ClickEvent'
import { HoverEvent } from './HoverEvent'

/**
 * Zod schema describing an Insights event.
 *
 * @remarks
 * Insights events currently include {@link ViewEvent},
 * {@link ClickEvent}, and {@link HoverEvent}.
 *
 * @public
 */
export const InsightsEvent = z.discriminatedUnion('type', [ViewEvent, ClickEvent, HoverEvent])

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
