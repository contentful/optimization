import { z } from 'zod/mini'
import { UniversalEventProperties } from './UniversalEventProperties'
import { Page } from './properties'

export const PageViewEvent = z.extend(UniversalEventProperties, {
  type: z.literal('page'),
  name: z.optional(z.string()),
  properties: Page,
})
export type PageViewEvent = z.infer<typeof PageViewEvent>
