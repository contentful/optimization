import { z } from 'zod/mini'
import { UniversalEventProperties } from './UniversalEventProperties'

export const GroupEvent = z.extend(UniversalEventProperties, {
  type: z.literal('group'),
})
export type GroupEvent = z.infer<typeof GroupEvent>
