import { literal, union, type infer as zInfer } from 'zod/mini'

export const Channel = union([literal('mobile'), literal('server'), literal('web')])
export type Channel = zInfer<typeof Channel>
