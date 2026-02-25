import * as z from 'zod/mini'

/**
 * Zod schema describing screen-level properties for events.
 *
 * @remarks
 * The base object describes standard screen attributes, while additional
 * JSON properties may be present due to the use of `z.catchall`.
 *
 * @public
 */
export const Screen = z.catchall(
  z.object({
    /**
     * Name or label for the screen.
     */
    name: z.string(),
  }),
  z.json(),
)

/**
 * TypeScript type inferred from {@link Screen}.
 *
 * @public
 */
export type Screen = z.infer<typeof Screen>
