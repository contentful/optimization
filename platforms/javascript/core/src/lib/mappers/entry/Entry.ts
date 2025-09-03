import {
  array,
  extend,
  looseObject,
  number,
  object,
  optional,
  string,
  type infer as zInfer,
} from 'zod/mini'

export const EntryFields = looseObject(object({}).shape)
export type EntryFields = zInfer<typeof EntryFields>

const EntryLink = object({
  type: optional(string()),
  link: optional(string()),
  id: string(),
})

const LinkedEntity = object({
  sys: EntryLink,
})

export const Entry = object({
  sys: object({
    type: optional(string()),
    id: string(),
    createdAt: optional(string()),
    updatedAt: optional(string()),
    locale: optional(string()),
    revision: optional(number()),
    space: optional(LinkedEntity),
    environment: optional(LinkedEntity),
    content: optional(LinkedEntity),
  }),
  fields: EntryFields,
  metadata: optional(
    object({
      tags: array(
        object({
          sys: extend(EntryLink, { link: string() }),
        }),
      ),
    }),
  ),
})
export type Entry = zInfer<typeof Entry>
