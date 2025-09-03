import { extend, literal, number, optional, string, union, type infer as zInfer } from 'zod/mini'
import { UniversalEventProperties } from './UniversalEventProperties'

export const ComponentViewEvent = extend(UniversalEventProperties, {
  type: literal('component'),
  component: union([literal('Entry'), literal('Variable')]),
  componentId: string(),
  experienceId: optional(string()),
  variantIndex: number(),
})
export type ComponentViewEvent = zInfer<typeof ComponentViewEvent>
