import { z } from 'zod/mini'

export const ResponseEnvelope = z.object({
  data: z.object(),
  message: z.string(),
  error: z.nullable(z.boolean()),
})
export type ResponseEnvelope = z.infer<typeof ResponseEnvelope>
