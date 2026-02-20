import type { JSX } from 'react'
import {
  type UsePersonalizationResult,
  usePersonalization,
} from '../optimization/hooks/usePersonalization'
import type { RichTextDocument, RichTextNode } from '../types/contentful'

interface EmbeddedEntryInlineNode extends RichTextNode {
  nodeType: 'embedded-entry-inline'
  data: {
    target: unknown
  }
}

interface RichTextRendererProps {
  richText: RichTextDocument
}

type MergeTagValueResolver = UsePersonalizationResult['getMergeTagValue']
type MergeTagEntry = Parameters<MergeTagValueResolver>[0]
type RenderedRichTextNode = JSX.Element | string | null | RenderedRichTextNode[]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isEmbeddedEntryInline(node: RichTextNode): node is EmbeddedEntryInlineNode {
  return node.nodeType === 'embedded-entry-inline' && isRecord(node.data) && 'target' in node.data
}

function isLink(target: unknown): target is { sys: { type: 'Link' } } {
  if (!isRecord(target) || !isRecord(target.sys)) {
    return false
  }

  return target.sys.type === 'Link'
}

function isMergeTagEntry(entry: unknown): entry is MergeTagEntry {
  if (!isRecord(entry)) {
    return false
  }

  const { sys } = entry
  if (!isRecord(sys) || !isRecord(sys.contentType)) {
    return false
  }

  const { contentType } = sys
  if (!isRecord(contentType) || !isRecord(contentType.sys)) {
    return false
  }

  return contentType.sys.id === 'nt_mergetag'
}

function renderText(node: RichTextNode): string | null {
  if (node.nodeType === 'text' && typeof node.value === 'string') {
    return node.value
  }

  return null
}

function renderRichTextNode(
  node: RichTextNode,
  getMergeTagValue: MergeTagValueResolver,
  key: string,
): RenderedRichTextNode {
  const text = renderText(node)
  if (text !== null) {
    return text
  }

  if (node.nodeType === 'paragraph' && Array.isArray(node.content)) {
    return (
      <p key={key}>
        {node.content.map((child, index) => renderRichTextNode(child, getMergeTagValue, `${key}-p-${index}`))}
      </p>
    )
  }

  if (isEmbeddedEntryInline(node)) {
    const { data } = node
    const { target } = data

    if (isLink(target) || !isMergeTagEntry(target)) {
      return '[Merge Tag]'
    }

    return getMergeTagValue(target)
  }

  if (Array.isArray(node.content)) {
    return node.content.map((child, index) =>
      renderRichTextNode(child, getMergeTagValue, `${key}-c-${index}`),
    )
  }

  return null
}

function extractTextContent(node: RichTextNode, getMergeTagValue: MergeTagValueResolver): string {
  const text = renderText(node)
  if (text !== null) {
    return text
  }

  if (isEmbeddedEntryInline(node)) {
    const { data } = node
    const { target } = data

    if (isLink(target) || !isMergeTagEntry(target)) {
      return '[Merge Tag]'
    }

    return getMergeTagValue(target)
  }

  if (Array.isArray(node.content)) {
    return node.content.map((child) => extractTextContent(child, getMergeTagValue)).join('')
  }

  return ''
}

export function getRichTextContent(
  richText: RichTextDocument,
  getMergeTagValue: MergeTagValueResolver,
): string {
  return richText.content
    .map((node) => extractTextContent(node, getMergeTagValue))
    .join(' ')
    .trim()
}

export function RichTextRenderer({ richText }: RichTextRendererProps): JSX.Element {
  const { getMergeTagValue } = usePersonalization()

  return (
    <>
      {richText.content.map((node, index) =>
        renderRichTextNode(node, getMergeTagValue, `root-${index}`),
      )}
    </>
  )
}
