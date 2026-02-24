import * as z from 'zod/mini'

/**
 * Zod schema describing the analytics channel.
 *
 * @remarks
 * Indicates the execution environment where the event originated.
 *
 * - `'mobile'` — Events from native or hybrid mobile apps.
 * - `'server'` — Events emitted from backend/server-side code.
 * - `'web'` — Events from web browsers or web-based clients.
 *
 * @public
 */
export const Channel = z.union([z.literal('mobile'), z.literal('server'), z.literal('web')])

/**
 * TypeScript type inferred from {@link Channel}.
 *
 * @public
 */
export type Channel = z.infer<typeof Channel>
