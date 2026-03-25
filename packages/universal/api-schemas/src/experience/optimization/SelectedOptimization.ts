import * as z from 'zod/mini'

/**
 * Zod schema describing a selected optimization outcome for a user.
 *
 * @remarks
 * Represents the result of choosing a specific variant for a given
 * experience, along with additional metadata such as whether the
 * selection is sticky.
 *
 * @public
 */
export const SelectedOptimization = z.object({
  /**
   * Identifier of the personalization or experiment experience.
   */
  experienceId: z.string(),

  /**
   * Index of the selected variant within the experience configuration.
   *
   * @remarks
   * Typically corresponds to the index of the selected {@link OptimizationConfig } entry.
   */
  variantIndex: z.number(),

  /**
   * Mapping of baseline entry IDs to their selected variant entry IDs.
   *
   * @remarks
   * The keys are component identifiers and the values are the
   * identifiers of the selected variant for that component.
   */
  variants: z.record(z.string(), z.string()),

  /**
   * Indicates whether this optimization selection is sticky for the user.
   *
   * @defaultValue false
   *
   * @remarks
   * Sticky selections should be reused on subsequent requests for the
   * same user, rather than re-allocating a new variant.
   */
  sticky: z.optional(z.prefault(z.boolean(), false)),
})

/**
 * TypeScript type inferred from {@link SelectedOptimization}.
 *
 * @public
 */
export type SelectedOptimization = z.infer<typeof SelectedOptimization>

/**
 * Zod schema describing an array of {@link SelectedOptimization} items.
 *
 * @remarks
 * Useful when multiple experiences are evaluated at once.
 *
 * @public
 */
export const SelectedOptimizationArray = z.array(SelectedOptimization)

/**
 * TypeScript type inferred from {@link SelectedOptimizationArray}.
 *
 * @public
 */
export type SelectedOptimizationArray = z.infer<typeof SelectedOptimizationArray>
