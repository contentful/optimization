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
   * @defaultValue false
   */
  hidden: z.prefault(z.boolean(), false),
})

/**
 * TypeScript type inferred from {@link EntryReplacementVariant}.
 *
 * @public
 */
export type EntryReplacementVariant = z.infer<typeof EntryReplacementVariant>

/**
 * Type guard for {@link EntryReplacementVariant}.
 *
 * @param variant - Value to test.
 * @returns `true` if `variant` conforms to {@link EntryReplacementVariant}, otherwise `false`.
 *
 * @example
 * ```ts
 * if (isEntryReplacementVariant(variant)) {
 *   console.log(variant.id);
 * }
 * ```
 *
 * @public
 */
export function isEntryReplacementVariant(variant: unknown): variant is EntryReplacementVariant {
  return EntryReplacementVariant.safeParse(variant).success
}

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
 * Type guard for {@link EntryReplacementComponent}.
 *
 * @param component - Personalization component to test.
 * @returns `true` if the component is an EntryReplacement component, otherwise `false`.
 *
 * @example
 * ```ts
 * if (isEntryReplacementComponent(component)) {
 *   console.log(component.baseline.id);
 * }
 * ```
 *
 * @public
 */
export function isEntryReplacementComponent(
  component: PersonalizationComponent,
): component is EntryReplacementComponent {
  return component.type === 'EntryReplacement' || component.type === undefined
}

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
 * Type guard for {@link InlineVariableComponent}.
 *
 * @param component - Personalization component to test.
 * @returns `true` if the component is an InlineVariable component, otherwise `false`.
 *
 * @example
 * ```ts
 * if (isInlineVariableComponent(component)) {
 *   console.log(component.key, component.valueType);
 * }
 * ```
 *
 * @public
 */
export function isInlineVariableComponent(
  component: PersonalizationComponent,
): component is InlineVariableComponent {
  return component.type === 'InlineVariable'
}

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
   * @defaultValue [0.5, 0.5]
   */
  distribution: z.optional(z.prefault(z.array(z.number()), [0.5, 0.5])),

  /**
   * Percentage of total traffic that should enter the personalization.
   *
   * @defaultValue 0
   */
  traffic: z.optional(z.prefault(z.number(), 0)),

  /**
   * Personalization components that define how content is varied.
   *
   * @defaultValue
   * A single {@link EntryReplacementComponent} with an empty `baseline` and `variants` ID.
   */
  components: z.optional(
    z.prefault(PersonalizationComponentArray, [
      {
        type: 'EntryReplacement',
        baseline: { id: '' },
        variants: [{ id: '' }],
      },
    ]),
  ),

  /**
   * Controls whether the assignment should be sticky for a given user.
   *
   * @defaultValue false
   */
  sticky: z.optional(z.prefault(z.boolean(), false)),
})

/**
 * TypeScript type inferred from {@link PersonalizationConfig}.
 *
 * @public
 */
export type PersonalizationConfig = z.infer<typeof PersonalizationConfig>
