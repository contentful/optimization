import { z } from 'zod/mini'
import { UniversalEventProperties } from './UniversalEventProperties'

export const AliasEvent = z.extend(UniversalEventProperties, {
  type: z.literal('alias'),
})
export type AliasEvent = z.infer<typeof AliasEvent>
