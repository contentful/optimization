import * as z from 'zod/mini'

/**
 * Enumeration of supported change types.
 *
 * @remarks
 * Currently only the `'Variable'` change type is supported, but the union
 * in {@link ChangeBase} allows for additional types to be introduced.
 */
export const ChangeType = ['Variable'] as const

/**
 * Zod schema describing the base shape for a change.
 *
 * @remarks
 * This base is extended by specific change types such as {@link VariableChange}.
 */
const ChangeBase = z.object({
  /**
   * Key identifying the subject of the change.
   */
  key: z.string(),

  /**
   * Discriminator for the change type.
   *
   * @remarks
   * May be one of {@link ChangeType} or an arbitrary string for unknown types.
   */
  type: z.union([z.enum(ChangeType), z.string()]),

  /**
   * Metadata describing the originating experience and variant index.
   */
  meta: z.object({
    /**
     * Identifier of the personalization or experiment experience.
     */
    experienceId: z.string(),

    /**
     * Index of the variant within the experience configuration.
     *
     * @remarks
     * Typically corresponds to the array index in the experience's distribution.
     */
    variantIndex: z.number(),
  }),
})

/**
 * Zod schema for the allowed value types of a variable change.
 *
 * @remarks
 * Supports primitives and JSON objects keyed by strings.
 */
export const VariableChangeValue = z.union([
  z.string(),
  z.boolean(),
  z.null(),
  z.number(),
  z.record(z.string(), z.json()),
])

/**
 * Zod schema representing an unknown change type.
 *
 * @remarks
 * This can be used to handle forward-compatible change payloads where
 * the `type` is not recognized.
 */
export const UnknownChange = z.extend(ChangeBase, {
  /**
   * Unconstrained change type string.
   */
  type: z.string(),

  /**
   * Payload for the change value, with unknown structure.
   */
  value: z.unknown(),
})

/**
 * TypeScript type inferred from {@link UnknownChange}.
 */
export type UnknownChange = z.infer<typeof UnknownChange>

/**
 * Zod schema representing a change whose type is `'Variable'`.
 *
 * @remarks
 * The `value` must conform to {@link VariableChangeValue}.
 */
export const VariableChange = z.extend(ChangeBase, {
  /**
   * Discriminator for a variable change.
   */
  type: z.literal('Variable'),

  /**
   * New value for the variable identified by {@link ChangeBase.key}.
   */
  value: VariableChangeValue,
})

/**
 * TypeScript type inferred from {@link VariableChange}.
 */
export type VariableChange = z.infer<typeof VariableChange>

/**
 * JSON value type inferred from {@link z.json}.
 *
 * @remarks
 * Represents any JSON-serializable value.
 */
export type Json = z.infer<typeof z.json>

/**
 * Map of Custom Flag keys to JSON values.
 */
export type Flags = Record<string, Json>

/**
 * Union of supported change types.
 *
 * @remarks
 * Currently only {@link VariableChange} is included.
 */
export const Change = z.discriminatedUnion('type', [VariableChange])

/**
 * TypeScript type inferred from {@link Change}.
 */
export type Change = z.infer<typeof Change>

/**
 * Zod schema representing an array of {@link Change} items.
 */
export const ChangeArray = z.array(Change)

/**
 * TypeScript type inferred from {@link ChangeArray}.
 */
export type ChangeArray = z.infer<typeof ChangeArray>
