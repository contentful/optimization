import { z } from 'zod/mini'

export const Channel = z.union([z.literal('mobile'), z.literal('server'), z.literal('web')])
export type Channel = z.infer<typeof Channel>
