import type { Document } from '@contentful/rich-text-types'
import type { Entry, EntryFieldTypes, EntrySkeletonType } from 'contentful'

export interface ContentEntryFields {
  text?: EntryFieldTypes.Text | EntryFieldTypes.RichText
  nested?: EntryFieldTypes.Array<EntryFieldTypes.EntryLink<ContentEntrySkeleton>>
}

export type ContentEntrySkeleton = EntrySkeletonType<ContentEntryFields>
export type ContentEntry = Entry<ContentEntrySkeleton>
export type RichTextDocument = Document
