import * as z from 'zod/mini'

/**
 * Zod schema describing campaign attribution properties.
 *
 * @remarks
 * These fields typically mirror UTM parameters used for marketing campaigns.
 */
export const Campaign = z.object({
  /**
   * Name of the campaign (e.g., `utm_campaign`).
   */
  name: z.optional(z.string()),

  /**
   * Campaign source (e.g., `utm_source`).
   */
  source: z.optional(z.string()),

  /**
   * Campaign medium (e.g., `utm_medium`).
   */
  medium: z.optional(z.string()),

  /**
   * Campaign term (e.g., `utm_term`).
   */
  term: z.optional(z.string()),

  /**
   * Campaign content (e.g., `utm_content`).
   */
  content: z.optional(z.string()),
})

/**
 * TypeScript type inferred from {@link Campaign}.
 */
export type Campaign = z.infer<typeof Campaign>
