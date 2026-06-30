import type {
  ChainModifiers,
  Entry,
  EntryFieldTypes,
  EntrySkeletonType,
  LocaleCode,
  UnresolvedLink,
} from 'contentful'
import * as z from 'zod/mini'
import type { AudienceEntry, AudienceEntrySkeleton } from './AudienceEntry'
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
 * Zod schema describing the optimization-owned fields of an Optimization entry.
 *
 * @remarks
 * Contentful references are checked structurally by the entry type guards. This
 * schema owns only scalar and JSON fields whose shape belongs to Optimization.
 *
 * @public
 */
export const OptimizationEntryFields = z.object({
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
   * The audience reference of the optimization.
   */
  nt_audience: z.optional(z.nullable(z.unknown())),

  /**
   * All used variants of the optimization.
   */
  nt_variants: z.optional(z.array(z.unknown())),

  /**
   * The optimization/experience ID related to this optimization entry.
   */
  nt_experience_id: z.string(),
})

/**
 * Runtime field values for an Optimization entry.
 *
 * @public
 */
export interface OptimizationEntryFields<
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
> {
  nt_name: string
  nt_description?: string | null
  nt_type: OptimizationType
  nt_config?: OptimizationConfig | null
  nt_audience?: AudienceEntry<M, L> | UnresolvedLink<'Entry'> | null
  nt_variants?: Array<Entry<EntrySkeletonType, M, L> | UnresolvedLink<'Entry'>>
  nt_experience_id: string
}

/**
 * Contentful SDK skeleton for the `nt_experience` content type.
 *
 * @public
 */
export type OptimizationEntrySkeleton = EntrySkeletonType<
  {
    nt_name: EntryFieldTypes.Symbol
    nt_description: EntryFieldTypes.Symbol
    nt_type: EntryFieldTypes.Symbol<OptimizationType>
    nt_config: EntryFieldTypes.Object
    nt_audience: EntryFieldTypes.EntryLink<AudienceEntrySkeleton>
    nt_variants: EntryFieldTypes.Array<EntryFieldTypes.EntryLink<EntrySkeletonType>>
    nt_experience_id: EntryFieldTypes.Symbol
  },
  'nt_experience'
>

/**
 * Resolved Contentful Optimization entry.
 *
 * @public
 */
export type OptimizationEntry<
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
> = Omit<Entry<OptimizationEntrySkeleton, M, L>, 'fields'> & {
  fields: OptimizationEntryFields<M, L>
}

/**
 * Optimization entry references as returned in optimized entry fields.
 *
 * @public
 */
export type OptimizationEntryArray<
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
> = Array<OptimizationEntry<M, L> | UnresolvedLink<'Entry'>>
