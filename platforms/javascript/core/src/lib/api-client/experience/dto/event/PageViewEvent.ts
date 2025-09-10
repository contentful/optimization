import { z } from 'zod/mini'
import { UniversalEventProperties } from './UniversalEventProperties'
import { PageView } from './properties'

export const PageViewEvent = z.extend(UniversalEventProperties, {
  type: z.literal('page'),
  name: z.optional(z.string()),
  properties: PageView,
})
export type PageViewEvent = z.infer<typeof PageViewEvent>
