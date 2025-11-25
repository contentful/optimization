import * as z from 'zod/mini'

/**
 * Zod schema describing a generic collection of event properties.
 *
 * @remarks
 * Represents an arbitrary JSON-serializable map from string keys to values.
 */
export const Properties = z.record(z.string(), z.json())

/**
 * TypeScript type inferred from {@link Properties}.
 */
export type Properties = z.infer<typeof Properties>
