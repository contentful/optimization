import { extend, literal, optional, string, type infer as zInfer } from 'zod/mini'
import { UniversalEventProperties } from './UniversalEventProperties'
import { PageView } from './properties'

export const PageViewEvent = extend(UniversalEventProperties, {
  type: literal('page'),
  name: optional(string()),
  properties: PageView,
})
export type PageViewEventType = zInfer<typeof PageViewEvent>
