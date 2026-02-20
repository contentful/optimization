import type { Entry } from 'contentful'

export interface ContentfulSys {
  id: string
  contentType: {
    sys: {
      id: string
    }
  }
}

export interface RichTextNode {
  nodeType: string
  content?: RichTextNode[]
  data?: Record<string, unknown>
  value?: string
}

export interface RichTextDocument {
  nodeType: 'document'
  content: RichTextNode[]
}

export type ContentfulEntry = Entry

export interface ContentfulCollectionResponse {
  items: ContentfulEntry[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasStringId(value: unknown): value is { id: string } {
  return isRecord(value) && typeof value.id === 'string'
}

function hasContentTypeId(value: unknown): value is { contentType: { sys: { id: string } } } {
  if (!isRecord(value)) {
    return false
  }

  const { contentType } = value

  if (!isRecord(contentType)) {
    return false
  }

  const { sys } = contentType

  return isRecord(sys) && typeof sys.id === 'string'
}

function hasSysAndFields(value: unknown): value is { sys: unknown; fields: unknown } {
  if (!isRecord(value)) {
    return false
  }

  return 'sys' in value && 'fields' in value
}

export function isRichTextDocument(value: unknown): value is RichTextDocument {
  if (!isRecord(value)) {
    return false
  }

  const { nodeType, content } = value

  return nodeType === 'document' && Array.isArray(content)
}

export function isContentfulEntry(value: unknown): value is ContentfulEntry {
  if (!hasSysAndFields(value)) {
    return false
  }

  const { sys, fields } = value

  if (!isRecord(sys) || !isRecord(fields)) {
    return false
  }

  if (!hasStringId(sys) || !('metadata' in value)) {
    return false
  }

  return hasContentTypeId(sys)
}
