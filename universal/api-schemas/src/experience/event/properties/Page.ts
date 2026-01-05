import * as z from 'zod/mini'
import { Dictionary } from './Dictionary'

/**
 * Zod schema describing Web page-level properties for events.
 *
 * @remarks
 * The base object describes standard page attributes, while additional
 * JSON properties may be present due to the use of `z.catchall`.
 */
export const Page = z.catchall(
  z.object({
    /**
     * Path component of the page URL (e.g., `/products/123`).
     */
    path: z.string(),

    /**
     * Parsed query parameters for the page.
     */
    query: Dictionary,

    /**
     * Referrer URL that led to the current page.
     */
    referrer: z.string(),

    /**
     * Raw search string including the leading `?` (e.g., `"?q=test"`).
     */
    search: z.string(),

    /**
     * Title of the page as seen by the user.
     */
    title: z.optional(z.string()),

    /**
     * Full URL of the page.
     */
    url: z.string(),
  }),
  z.json(),
)

/**
 * TypeScript type inferred from {@link Page}.
 */
export type Page = z.infer<typeof Page>
