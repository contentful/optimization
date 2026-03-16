import * as z from 'zod/mini'

/**
 * Zod schema describing a single entry replacement variant.
 *
 * @remarks
 * Each variant is identified by an `id` and may be marked as `hidden`.
 *
 * @public
 */
export const EntryReplacementVariant = z.object({
  /**
   * Unique identifier for the variant.
   */
  id: z.string(),

  /**
   * Indicates whether this variant is hidden from allocation/traffic.
   *
   */
  hidden: z.optional(z.boolean()),
})

/**
 * TypeScript type inferred from {@link EntryReplacementVariant}.
 *
 * @public
 */
export type EntryReplacementVariant = z.infer<typeof EntryReplacementVariant>

/**
 * Zod schema describing an entry replacement personalization component.
 *
 * @remarks
 * This component replaces a baseline entry with one of several variants.
 *
 * @public
 */
export const EntryReplacementComponent = z.object({
  /**
   * Discriminator for the component type.
   *
   * @remarks
   * May be omitted, in which case the component is treated as an EntryReplacement.
   */
  type: z.optional(z.literal('EntryReplacement')),

  /**
   * Baseline variant used when no targeting or allocation selects another variant.
   */
  baseline: EntryReplacementVariant,

  /**
   * Additional variants that may be served.
   */
  variants: z.array(EntryReplacementVariant),
})

/**
 * TypeScript type inferred from {@link EntryReplacementComponent}.
 *
 * @public
 */
export type EntryReplacementComponent = z.infer<typeof EntryReplacementComponent>

/**
 * Zod schema describing a variant for inline variables.
 *
 * @remarks
 * The value may be a primitive or a JSON object.
 *
 * @public
 */
export const InlineVariableVariant = z.object({
  /**
   * Variant value for the inline variable.
   */
  value: z.union([z.string(), z.boolean(), z.null(), z.number(), z.record(z.string(), z.json())]),
})

/**
 * Enumeration of supported inline variable value types.
 *
 * @public
 */
export const InlineVariableComponentValueType = z.enum(['Boolean', 'Number', 'Object', 'String'])

/**
 * Zod schema describing an inline variable personalization component.
 *
 * @remarks
 * Used to vary scalar or object values in templates.
 *
 * @public
 */
export const InlineVariableComponent = z.object({
  /**
   * Discriminator for the inline variable component.
   */
  type: z.literal('InlineVariable'),

  /**
   * Key under which this variable is exposed to the template.
   */
  key: z.string(),

  /**
   * Describes the runtime type of the values for this variable.
   */
  valueType: InlineVariableComponentValueType,

  /**
   * Baseline value used when no targeting or allocation selects another variant.
   */
  baseline: InlineVariableVariant,

  /**
   * Additional variable variants for experimentation or personalization.
   */
  variants: z.array(InlineVariableVariant),
})

/**
 * TypeScript type inferred from {@link InlineVariableComponent}.
 *
 * @public
 */
export type InlineVariableComponent = z.infer<typeof InlineVariableComponent>

/**
 * Discriminated union of all supported personalization components.
 *
 * @public
 */
export const PersonalizationComponent = z.discriminatedUnion('type', [
  EntryReplacementComponent,
  InlineVariableComponent,
])

/**
 * TypeScript type inferred from {@link PersonalizationComponent}.
 *
 * @public
 */
export type PersonalizationComponent = z.infer<typeof PersonalizationComponent>

/**
 * Zod schema representing an array of {@link PersonalizationComponent} items.
 *
 * @public
 */
export const PersonalizationComponentArray = z.array(PersonalizationComponent)

/**
 * TypeScript type inferred from {@link PersonalizationComponentArray}.
 *
 * @public
 */
export type PersonalizationComponentArray = z.infer<typeof PersonalizationComponentArray>

/**
 * Zod schema describing the full configuration for a personalization.
 *
 * @remarks
 * Provides distribution, traffic allocation, component definitions, and sticky behavior.
 *
 * @public
 */
export const PersonalizationConfig = z.object({
  /**
   * Variant distribution used for traffic allocation.
   *
   */
  distribution: z.optional(z.array(z.number())),

  /**
   * Percentage of total traffic that should enter the personalization.
   *
   */
  traffic: z.optional(z.number()),

  /**
   * Personalization components that define how content is varied.
   *
   */
  components: z.optional(PersonalizationComponentArray),

  /**
   * Controls whether the assignment should be sticky for a given user.
   *
   */
  sticky: z.optional(z.boolean()),
})

/**
 * TypeScript type inferred from {@link PersonalizationConfig}.
 *
 * @public
 */
export type PersonalizationConfig = z.infer<typeof PersonalizationConfig>

/**
 * Runtime-safe view of a personalization config.
 *
 * @remarks
 * This helper deliberately uses empty/falsey defaults that are safe for SDK
 * consumers. Authoring-time placeholder defaults belong outside runtime
 * validation.
 *
 * @public
 */
export interface NormalizedPersonalizationConfig {
  distribution: number[]
  traffic: number
  components: PersonalizationComponent[]
  sticky: boolean
}

/**
 * Normalizes a personalization config for runtime consumers.
 *
 * @param config - Raw personalization config value from Contentful.
 * @returns Config with concrete runtime-safe defaults for omitted fields.
 *
 * @public
 */
export function normalizePersonalizationConfig(
  config: PersonalizationConfig | null | undefined,
): NormalizedPersonalizationConfig {
  return {
    distribution: config?.distribution === undefined ? [] : [...config.distribution],
    traffic: config?.traffic ?? 0,
    components: config?.components === undefined ? [] : [...config.components],
    sticky: config?.sticky ?? false,
  }
}
