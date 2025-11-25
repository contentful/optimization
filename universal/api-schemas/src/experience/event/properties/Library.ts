import * as z from 'zod/mini'

/**
 * Zod schema describing analytics library metadata.
 *
 * @remarks
 * Identifies the client library that produced the event.
 */
export const Library = z.object({
  /**
   * Name of the SDK/library (e.g., `"@contentful/optimization-web"`).
   */
  name: z.string(),

  /**
   * Version of the analytics library.
   */
  version: z.string(),
})

/**
 * TypeScript type inferred from {@link Library}.
 */
export type Library = z.infer<typeof Library>
