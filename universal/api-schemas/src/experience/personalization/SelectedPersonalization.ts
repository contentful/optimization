import * as z from 'zod/mini'

/**
 * Zod schema describing a selected personalization outcome for a user.
 *
 * @remarks
 * Represents the result of choosing a specific variant for a given
 * experience, along with additional metadata such as whether the
 * selection is sticky.
 */
export const SelectedPersonalization = z.object({
  /**
   * Identifier of the personalization or experiment experience.
   */
  experienceId: z.string(),

  /**
   * Index of the selected variant within the experience configuration.
   *
   * @remarks
   * Typically corresponds to the index of the selected {@link PersonalizationConfig } entry.
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
   * Indicates whether this personalization selection is sticky for the user.
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
 * TypeScript type inferred from {@link SelectedPersonalization}.
 */
export type SelectedPersonalization = z.infer<typeof SelectedPersonalization>

/**
 * Zod schema describing an array of {@link SelectedPersonalization} items.
 *
 * @remarks
 * Useful when multiple experiences are evaluated at once.
 */
export const SelectedPersonalizationArray = z.array(SelectedPersonalization)

/**
 * TypeScript type inferred from {@link SelectedPersonalizationArray}.
 */
export type SelectedPersonalizationArray = z.infer<typeof SelectedPersonalizationArray>
