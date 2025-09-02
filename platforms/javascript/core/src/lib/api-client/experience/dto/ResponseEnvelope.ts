import { boolean, nullable, object, string, type infer as zInfer } from 'zod/mini'

export const ResponseEnvelope = object({
  data: object(),
  message: string(),
  error: nullable(boolean()),
})
export type ResponseEnvelope = zInfer<typeof ResponseEnvelope>
