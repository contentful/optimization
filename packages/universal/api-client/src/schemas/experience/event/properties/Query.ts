import * as z from 'zod/mini'

/**
 * Zod schema describing parsed query parameters.
 *
 * @remarks
 * A key that appears once maps to its string value. A key that repeats maps to
 * an array of its values in order, as the Experience API accepts.
 *
 * @public
 */
export const Query = z.record(z.string(), z.union([z.string(), z.array(z.string())]))

/**
 * TypeScript type inferred from {@link Query}.
 *
 * @public
 */
export type Query = z.infer<typeof Query>
