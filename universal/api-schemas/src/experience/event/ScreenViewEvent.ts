import * as z from 'zod/mini'
import { UniversalEventContext, UniversalEventProperties } from './UniversalEventProperties'
import { Properties, Screen } from './properties'

/**
 * Zod schema describing event context properties specific to screen events
 */
export const ScreenEventContext = z.extend(UniversalEventContext, {
  /**
   * Screen context for events that occur within a web page.
   */
  screen: Screen,
})

/**
 * TypeScript type inferred from {@link ScreenEventContext}.
 */
export type ScreenEventContext = z.infer<typeof ScreenEventContext>

/**
 * Zod schema describing a `screen` view event.
 *
 * @remarks
 * Screen view events are typically used by mobile or TV applications
 * to track navigation between screens.
 *
 * Extends {@link UniversalEventProperties}.
 */
export const ScreenViewEvent = z.extend(UniversalEventProperties, {
  /**
   * Discriminator indicating that this event is a screen view.
   */
  type: z.literal('screen'),

  /**
   * Name of the screen being viewed.
   */
  name: z.string(),

  /**
   * Optional properties describing the screen context.
   *
   * @see Properties
   */
  properties: z.optional(Properties),

  /*
   * Override the context property of {@link UniversalEventProperties}
   * with a screen-specific context
   */
  context: ScreenEventContext,
})

/**
 * TypeScript type inferred from {@link ScreenViewEvent}.
 */
export type ScreenViewEvent = z.infer<typeof ScreenViewEvent>
