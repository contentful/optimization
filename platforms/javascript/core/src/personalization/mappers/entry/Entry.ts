import type { Entry as ContentfulEntry } from 'contentful'
import { z } from 'zod/mini'

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

const ContentTypeLink = z.object({
  sys: z.object({
    type: z.literal('Link'),
    linkType: z.literal('ContentType'),
    id: z.string(),
  }),
})

const EnvironmentLink = z.object({
  sys: z.object({
    type: z.literal('Link'),
    linkType: z.literal('Environment'),
    id: z.string(),
  }),
})

const SpaceLink = z.object({
  sys: z.object({
    type: z.literal('Link'),
    linkType: z.literal('Space'),
    id: z.string(),
  }),
})

const TagLink = z.object({
  sys: z.object({
    type: z.literal('Link'),
    linkType: z.literal('Tag'),
    id: z.string(),
  }),
})

export const Entry = z.object({
  fields: EntryFields,
  metadata: z.object({
    tags: z.array(TagLink),
  }),
  sys: z.object({
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
  }),
})
export type Entry = z.infer<typeof Entry>

export function isEntry(entry: ContentfulEntry | undefined): entry is Entry {
  return Entry.safeParse(entry).success
}
