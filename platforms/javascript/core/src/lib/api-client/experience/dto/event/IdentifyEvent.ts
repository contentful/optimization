import { z } from 'zod/mini'
import { UniversalEventProperties } from './UniversalEventProperties'
import { Traits } from './properties/Traits'

export const IdentifyEvent = z.extend(UniversalEventProperties, {
  type: z.literal('identify'),
  traits: Traits,
})
export type IdentifyEvent = z.infer<typeof IdentifyEvent>
