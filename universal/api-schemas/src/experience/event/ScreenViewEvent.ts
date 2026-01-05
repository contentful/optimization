import * as z from 'zod/mini'
import { UniversalEventProperties } from './UniversalEventProperties'
import { Properties } from './properties'

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
   * Additional properties describing the screen context.
   *
   * @see Properties
   */
  properties: Properties,
})

/**
 * TypeScript type inferred from {@link ScreenViewEvent}.
 */
export type ScreenViewEvent = z.infer<typeof ScreenViewEvent>
