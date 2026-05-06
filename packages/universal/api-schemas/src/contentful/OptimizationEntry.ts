import * as z from 'zod/mini'
import { AudienceEntry } from './AudienceEntry'
import { CtflEntry, EntryFields, Link } from './CtflEntry'
import { OptimizationConfig } from './OptimizationConfig'

/**
 * Union of supported optimization types.
 *
 * @remarks
 * `nt_experiment` represents experiments (A/B tests), and `nt_personalization`
 * represents personalizations.
 *
 * @public
 */
export const OptimizationType = z.union([
  z.literal('nt_experiment'),
  z.literal('nt_personalization'),
])

/**
 * TypeScript type inferred from {@link OptimizationType}.
 *
 * @public
 */
export type OptimizationType = z.infer<typeof OptimizationType>

/**
 * Zod schema describing the fields of an Optimization entry.
 *
 * @remarks
 * Extends the generic {@link EntryFields} with optimization-specific
 * properties such as name, description, type, config, audience, and variants.
 *
 * @public
 */
export const OptimizationEntryFields = z.extend(EntryFields, {
  /**
   * The name of the optimization (Short Text).
   */
  nt_name: z.string(),

  /**
   * The description of the optimization (Short Text).
   *
   * @remarks
   * Optional and can be `null` if no description is provided.
   */
  nt_description: z.optional(z.nullable(z.string())),

  /**
   * The type of the optimization (`nt_experiment` | `nt_personalization`).
   */
  nt_type: OptimizationType,

  /**
   * The configuration of an {@link OptimizationEntry } (JSON).
   */
  nt_config: z.optional(z.nullable(OptimizationConfig)),

  /**
   * The audience of the optimization (Audience).
   *
   * @remarks
   * Optional and nullable; when omitted or `null`, the optimization can apply
   * to all users.
   */
  nt_audience: z.optional(z.nullable(AudienceEntry)),

  /**
   * All used variants of the optimization (Contentful references to other Content Types).
   *
   * @remarks
   * Modeled as an array of Contentful links or resolved entries.
   */
  nt_variants: z.optional(z.array(z.union([Link, CtflEntry]))),

  /**
   * The optimization/experience ID related to this optimization entry.
   */
  nt_experience_id: z.string(),
})

/**
 * TypeScript type inferred from {@link OptimizationEntryFields}.
 *
 * @public
 */
export type OptimizationEntryFields = z.infer<typeof OptimizationEntryFields>

/**
 * Zod schema describing an Optimization entry, which is associated with an {@link OptimizedEntry } via its `fields.nt_experiences`.
 *
 * @public
 */
export const OptimizationEntry = z.extend(CtflEntry, {
  fields: OptimizationEntryFields,
})

/**
 * TypeScript type inferred from {@link OptimizationEntry}.
 *
 * @public
 */
export type OptimizationEntry = z.infer<typeof OptimizationEntry>

/**
 * Zod schema describing an Optimization entry "skeleton".
 *
 * @public
 */
export const OptimizationEntrySkeleton = z.object({
  contentTypeId: z.literal('nt_experience'),
  fields: OptimizationEntryFields,
})

/**
 * TypeScript type inferred from {@link OptimizationEntrySkeleton}.
 *
 * @public
 */
export type OptimizationEntrySkeleton = z.infer<typeof OptimizationEntrySkeleton>

/**
 * Zod schema describing an array of optimization entries or links.
 *
 * @remarks
 * Each element can be a {@link Link} or a fully resolved {@link OptimizationEntry}.
 *
 * @public
 */
export const OptimizationEntryArray = z.array(z.union([Link, OptimizationEntry]))

/**
 * TypeScript type inferred from {@link OptimizationEntryArray}.
 *
 * @public
 */
export type OptimizationEntryArray = z.infer<typeof OptimizationEntryArray>
