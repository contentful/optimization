import { array, minLength, object, optional, string, type infer as zInfer } from 'zod/mini'
import { EventArray } from './event'

export const OptimizationRequestOptions = object({
  features: optional(array(string())),
})
export type OptimizationRequestOptionsType = zInfer<typeof OptimizationRequestOptions>

export const OptimizationRequestData = object({
  events: EventArray.check(minLength(1)),
  options: optional(OptimizationRequestOptions),
})
export type OptimizationRequestDataType = zInfer<typeof OptimizationRequestData>
