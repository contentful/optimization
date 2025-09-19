import { z } from 'zod/mini'
import { UniversalEventProperties } from './UniversalEventProperties'
import { Properties } from './properties'

export const PageViewEvent = z.extend(UniversalEventProperties, {
  type: z.literal('page'),
  name: z.optional(z.string()),
  properties: Properties,
})
export type PageViewEvent = z.infer<typeof PageViewEvent>
