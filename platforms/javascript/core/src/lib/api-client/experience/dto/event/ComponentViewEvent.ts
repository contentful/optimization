import { z } from 'zod/mini'
import { UniversalEventProperties } from './UniversalEventProperties'

export const ComponentViewEvent = z.extend(UniversalEventProperties, {
  type: z.literal('component'),
  component: z.union([z.literal('Entry'), z.literal('Variable')]),
  componentId: z.string(),
  experienceId: z.optional(z.string()),
  variantIndex: z.number(),
})
export type ComponentViewEvent = z.infer<typeof ComponentViewEvent>
