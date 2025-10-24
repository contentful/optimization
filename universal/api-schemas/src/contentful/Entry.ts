import type { Entry as ContentfulEntry } from 'contentful'
import * as z from 'zod/mini'

export const EntryFields = z.catchall(z.object({}), z.json())
export type EntryFields = z.infer<typeof EntryFields>

export const Link = z.object({
  sys: z.object({
    type: z.literal('Link'),
    linkType: z.string(),
    id: z.string(),
  }),
})
export type Link = z.infer<typeof Link>

export const ContentTypeLink = z.object({
  sys: z.object({
    type: z.literal('Link'),
    linkType: z.literal('ContentType'),
    id: z.string(),
  }),
})
export type ContentTypeLink = z.infer<typeof ContentTypeLink>

export const EnvironmentLink = z.object({
  sys: z.object({
    type: z.literal('Link'),
    linkType: z.literal('Environment'),
    id: z.string(),
  }),
})
export type EnvironmentLink = z.infer<typeof EnvironmentLink>

export const SpaceLink = z.object({
  sys: z.object({
    type: z.literal('Link'),
    linkType: z.literal('Space'),
    id: z.string(),
  }),
})
export type SpaceLink = z.infer<typeof SpaceLink>

export const TagLink = z.object({
  sys: z.object({
    type: z.literal('Link'),
    linkType: z.literal('Tag'),
    id: z.string(),
  }),
})
export type TagLink = z.infer<typeof TagLink>

export const EntrySys = z.object({
  type: z.literal('Entry'),
  contentType: ContentTypeLink,
  publishedVersion: z.number(),
  id: z.string(),
  createdAt: z.any(),
  updatedAt: z.any(),
  locale: z.optional(z.string()),
  revision: z.number(),
  space: SpaceLink,
  environment: EnvironmentLink,
})
export type EntrySys = z.infer<typeof EntrySys>

export const Entry = z.object({
  fields: EntryFields,
  metadata: z.catchall(
    z.object({
      tags: z.array(TagLink),
    }),
    z.json(),
  ),
  sys: EntrySys,
})
export type Entry = z.infer<typeof Entry>

export function isEntry(entry: ContentfulEntry | undefined): entry is Entry {
  return Entry.safeParse(entry).success
}
