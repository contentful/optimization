import * as z from 'zod/mini'

/**
 * Zod schema describing user traits / identity properties.
 *
 * @remarks
 * Represents an arbitrary JSON-serializable map from string keys to values.
 * Common traits may include `name`, `plan`, and custom attributes.
 */
export const Traits = z.record(z.string(), z.json())

/**
 * TypeScript type inferred from {@link Traits}.
 */
export type Traits = z.infer<typeof Traits>
