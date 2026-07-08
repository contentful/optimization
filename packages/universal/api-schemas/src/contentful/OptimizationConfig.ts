import * as z from 'zod/mini'

/**
 * Zod schema describing a single entry replacement variant.
 *
 * @remarks
 * Each variant is identified by an `id` and can carry a `hidden` flag.
 *
 * An **empty variant** — the content author's deliberate choice to show nothing for an
 * audience — is always encoded as `id: ""`. The resolver detects an empty variant via
 * `id === ""` and returns `isEmptyVariant: true` in `ResolvedData` so renderers can
 * suppress content while still emitting a component view impression for measurement.
 *
 * The `hidden` field on a variant has two possible states in Contentful-sourced data,
 * but is **not** the detection signal for an empty variant:
 *
 * - `hidden: true` — the content author explicitly selected "Use empty variant" in the
 *   Personalization UI. This is the deliberate author intent described by this feature.
 * - `hidden: false` (or absent) — an unfilled placeholder slot, created programmatically
 *   when a variant is added or unlinked but not yet filled with a real entry.
 *
 * Both states share `id: ""` and both result in `isEmptyVariant: true`. The `hidden`
 * field itself is **not** a reliable detection signal because the Experience API strips
 * it before runtime — `hidden` only survives in the Contentful CDA `nt_config` payload.
 * Always use `id === ""` to detect an empty variant.
 *
 * The `hidden` field on the **baseline** (`EntryReplacementComponent.baseline`) has a
 * different meaning: `true` excludes the entire component from variant resolution and
 * allocation. This is unrelated to the empty-variant concept above.
 *
 * @public
 */
export const EntryReplacementVariant = z.object({
  /**
   * Unique identifier for the variant. Empty string (`""`) for an empty variant —
   * both the deliberate "Use empty variant" choice and an unfilled placeholder slot.
   */
  id: z.string(),

  /**
   * On a **baseline**: `true` excludes the whole component from allocation.
   *
   * On a **variant**: can be `true` (author chose "Use empty variant") or `false`
   * (unfilled placeholder). Both states share `id: ""`. Do not use this field to
   * detect an empty variant — use `id === ""` instead. The Experience API strips
   * this field before runtime; it is only present in Contentful CDA `nt_config`.
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
 * Zod schema describing an entry replacement optimization component.
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
   * Can be omitted, in which case the component is treated as an EntryReplacement.
   */
  type: z.optional(z.literal('EntryReplacement')),

  /**
   * Baseline variant used when no targeting or allocation selects another variant.
   */
  baseline: EntryReplacementVariant,

  /**
   * Additional variants that can be served.
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
 * The value can be a primitive or a JSON object.
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
 * Discriminated union of all supported optimization components.
 *
 * @public
 */
export const OptimizationComponent = z.discriminatedUnion('type', [
  EntryReplacementComponent,
  InlineVariableComponent,
])

/**
 * TypeScript type inferred from {@link OptimizationComponent}.
 *
 * @public
 */
export type OptimizationComponent = z.infer<typeof OptimizationComponent>

/**
 * Zod schema representing an array of {@link OptimizationComponent} items.
 *
 * @public
 */
export const OptimizationComponentArray = z.array(OptimizationComponent)

/**
 * TypeScript type inferred from {@link OptimizationComponentArray}.
 *
 * @public
 */
export type OptimizationComponentArray = z.infer<typeof OptimizationComponentArray>

/**
 * Zod schema describing the full configuration for an optimization.
 *
 * @remarks
 * Provides distribution, traffic allocation, component definitions, and sticky behavior.
 *
 * @public
 */
export const OptimizationConfig = z.object({
  /**
   * Variant distribution used for traffic allocation.
   *
   */
  distribution: z.optional(z.array(z.number())),

  /**
   * Percentage of total traffic to include in the optimization.
   *
   */
  traffic: z.optional(z.number()),

  /**
   * Optimization components that define how content is varied.
   *
   */
  components: z.optional(OptimizationComponentArray),

  /**
   * Controls whether the assignment is sticky for a given user.
   *
   */
  sticky: z.optional(z.boolean()),
})

/**
 * TypeScript type inferred from {@link OptimizationConfig}.
 *
 * @public
 */
export type OptimizationConfig = z.infer<typeof OptimizationConfig>

/**
 * Runtime-safe view of an optimization config.
 *
 * @remarks
 * This helper deliberately uses empty/falsey defaults that are safe for SDK
 * consumers. Authoring-time placeholder defaults belong outside runtime
 * validation.
 *
 * @public
 */
export interface NormalizedOptimizationConfig {
  distribution: number[]
  traffic: number
  components: OptimizationComponent[]
  sticky: boolean
}

/**
 * Normalizes an optimization config for runtime consumers.
 *
 * @param config - Raw optimization config value from Contentful.
 * @returns Config with concrete runtime-safe defaults for omitted fields.
 *
 * @public
 */
export function normalizeOptimizationConfig(
  config: OptimizationConfig | null | undefined,
): NormalizedOptimizationConfig {
  return {
    distribution: config?.distribution === undefined ? [] : [...config.distribution],
    traffic: config?.traffic ?? 0,
    components: config?.components === undefined ? [] : [...config.components],
    sticky: config?.sticky ?? false,
  }
}
