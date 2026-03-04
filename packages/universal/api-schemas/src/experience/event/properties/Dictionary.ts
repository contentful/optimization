import * as z from 'zod/mini'

/**
 * Zod schema describing a simple string-to-string dictionary.
 *
 * @remarks
 * Commonly used for query parameters or other small key–value maps.
 *
 * @public
 */
export const Dictionary = z.record(z.string(), z.string())

/**
 * TypeScript type inferred from {@link Dictionary}.
 *
 * @public
 */
export type Dictionary = z.infer<typeof Dictionary>
