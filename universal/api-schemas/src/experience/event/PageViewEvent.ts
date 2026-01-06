import * as z from 'zod/mini'
import { UniversalEventContext, UniversalEventProperties } from './UniversalEventProperties'
import { Page } from './properties'

/**
 * Zod schema describing event context properties specific to page events
 */
export const PageEventContext = z.extend(UniversalEventContext, {
  /**
   * Page context for events that occur within a web page.
   */
  page: Page,
})

/**
 * TypeScript type inferred from {@link PageEventContext}.
 */
export type PageEventContext = z.infer<typeof PageEventContext>

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

  /*
   * Override the context property of {@link UniversalEventProperties}
   * with a page-specific context
   */
  context: PageEventContext,
})

/**
 * TypeScript type inferred from {@link PageViewEvent}.
 */
export type PageViewEvent = z.infer<typeof PageViewEvent>
