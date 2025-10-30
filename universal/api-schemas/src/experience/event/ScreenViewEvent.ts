import * as z from 'zod/mini'
import { UniversalEventProperties } from './UniversalEventProperties'
import { Screen } from './properties'

export const ScreenViewEvent = z.extend(UniversalEventProperties, {
  type: z.literal('screen'),
  properties: Screen,
})
export type ScreenViewEvent = z.infer<typeof ScreenViewEvent>
