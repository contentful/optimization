import * as z from 'zod/mini'
import { ExoViewEvent, ViewEvent } from '../../experience/event'
import { ClickEvent } from './ClickEvent'
import { ExoClickEvent } from './ExoClickEvent'
import { ExoHoverEvent } from './ExoHoverEvent'
import { HoverEvent } from './HoverEvent'

/**
 * Zod schema describing an Insights event.
 *
 * @remarks
 * Insights events include legacy component interactions and ExO node
 * interactions.
 *
 * @public
 */
export const InsightsEvent = z.discriminatedUnion('type', [
  ViewEvent,
  ClickEvent,
  HoverEvent,
  ExoViewEvent,
  ExoClickEvent,
  ExoHoverEvent,
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
