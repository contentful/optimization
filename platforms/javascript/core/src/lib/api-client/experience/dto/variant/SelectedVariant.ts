import { z } from 'zod/mini'

export const SelectedVariant = z.object({
  experienceId: z.string(),
  variantIndex: z.number(),
  variants: z.record(z.string(), z.string()),
  sticky: z.optional(z.prefault(z.boolean(), false)),
})
export type SelectedVariant = z.infer<typeof SelectedVariant>

export const SelectedVariantArray = z.array(SelectedVariant)
export type SelectedVariantArray = z.infer<typeof SelectedVariantArray>
