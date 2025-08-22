import { array, extend, type infer as zInfer, optional, object } from 'zod/mini'
import { Profile } from './profile'
import { ResponseEnvelope } from './ResponseEnvelope'

export const BatchOptimizationData = object({ profiles: optional(array(Profile)) })
export type BatchOptimizationDataType = zInfer<typeof BatchOptimizationData>

export const BatchOptimizationResponse = extend(ResponseEnvelope, { data: BatchOptimizationData })
export type BatchOptimizationResponseType = zInfer<typeof BatchOptimizationResponse>
