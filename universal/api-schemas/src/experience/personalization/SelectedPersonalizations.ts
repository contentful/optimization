import * as z from 'zod/mini'

export const SelectedPersonalization = z.object({
  experienceId: z.string(),
  variantIndex: z.number(),
  variants: z.record(z.string(), z.string()),
  sticky: z.optional(z.prefault(z.boolean(), false)),
})
export type SelectedPersonalization = z.infer<typeof SelectedPersonalization>

export const SelectedPersonalizationArray = z.array(SelectedPersonalization)
export type SelectedPersonalizationArray = z.infer<typeof SelectedPersonalizationArray>
