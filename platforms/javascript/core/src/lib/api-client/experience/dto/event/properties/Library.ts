import { object, string, type infer as zInfer } from 'zod/mini'

export const Library = object({
  name: string(),
  version: string(),
})

export type LibraryType = zInfer<typeof Library>
