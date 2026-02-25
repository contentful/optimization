import { en } from 'zod/locales'
import * as z from 'zod/mini'

z.config(en())

export function parseWithFriendlyError<T extends z.ZodMiniType>(
  schema: T,
  data: unknown,
): z.output<T> {
  const result = schema.safeParse(data)
  if (result.success) return result.data

  throw new Error(z.prettifyError(result.error))
}
