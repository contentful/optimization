import * as z from 'zod/mini'
import { UniversalEventProperties } from './UniversalEventProperties'
import { Page } from './properties'

/**
 * Zod schema describing a `page` view event.
 *
 * @remarks
 * Page view events track visits to web pages and associated context.
 *
 * Extends {@link UniversalEventProperties} with optional `name` and
 * page-level {@link Page} properties.
 */
export const PageViewEvent = z.extend(UniversalEventProperties, {
  /**
   * Discriminator indicating that this event is a page view.
   */
  type: z.literal('page'),

  /**
   * Optional name for the page.
   *
   * @remarks
   * Useful when the logical page name differs from the URL or title.
   */
  name: z.optional(z.string()),

  /**
   * Page-level properties such as URL, path, and referrer.
   */
  properties: Page,
})

/**
 * TypeScript type inferred from {@link PageViewEvent}.
 */
export type PageViewEvent = z.infer<typeof PageViewEvent>
