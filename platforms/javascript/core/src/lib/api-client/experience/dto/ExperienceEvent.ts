import * as z from 'zod/mini'

export const ExperienceEvent = z.object({})
export type ExperienceEvent = z.infer<typeof ExperienceEvent>
