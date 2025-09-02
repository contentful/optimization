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
export type EntryFieldsType = zInfer<typeof EntryFields>

const EntryLink = object({
  type: optional(string()),
  linkType: optional(string()),
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
    contentType: optional(LinkedEntity),
  }),
  fields: EntryFields,
  metadata: optional(
    object({
      tags: array(
        object({
          sys: extend(EntryLink, { linkType: string() }),
        }),
      ),
    }),
  ),
})
export type EntryType = zInfer<typeof Entry>
