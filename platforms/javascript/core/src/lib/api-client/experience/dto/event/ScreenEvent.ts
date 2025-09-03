import { z } from 'zod/mini'
import { UniversalEventProperties } from './UniversalEventProperties'

export const ScreenEvent = z.extend(UniversalEventProperties, {
  type: z.literal('screen'),
})
export type ScreenEvent = z.infer<typeof ScreenEvent>
