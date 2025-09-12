import { z } from 'zod/mini'

export const EntryFields = z.looseObject(z.object({}).shape)
export type EntryFields = z.infer<typeof EntryFields>

const EntryLink = z.object({
  type: z.optional(z.string()),
  link: z.optional(z.string()),
  id: z.string(),
})

const LinkedEntity = z.object({
  sys: EntryLink,
})

export const Entry = z.object({
  sys: z.object({
    type: z.optional(z.string()),
    id: z.string(),
    createdAt: z.optional(z.string()),
    updatedAt: z.optional(z.string()),
    locale: z.optional(z.string()),
    revision: z.optional(z.number()),
    space: z.optional(LinkedEntity),
    environment: z.optional(LinkedEntity),
    content: z.optional(LinkedEntity),
  }),
  fields: EntryFields,
  metadata: z.optional(
    z.object({
      tags: z.array(
        z.object({
          sys: z.extend(EntryLink, { link: z.string() }),
        }),
      ),
    }),
  ),
})
export type Entry = z.infer<typeof Entry>
