import { useOptimization } from '@contentful/optimization-react-web'
import { documentToReactComponents, type Options } from '@contentful/rich-text-react-renderer'
import { INLINES } from '@contentful/rich-text-types'
import type { JSX } from 'react'
import type { RichTextDocument } from '../types/contentful'
import { isRecord } from '../utils/typeGuards'

interface RichTextNode {
  nodeType: string
  content?: RichTextNode[]
  data?: Record<string, unknown>
  value?: string
}

interface RichTextRendererProps {
  richText: RichTextDocument
}

type GetMergeTagValue = ReturnType<typeof useOptimization>['getMergeTagValue']
type MergeTagEntry = Parameters<GetMergeTagValue>[0]

const EMBEDDED_ENTRY_NODE_TYPE = 'embedded-entry-inline'

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

function getMergeTagText(target: unknown, getMergeTagValue: GetMergeTagValue): string {
  if (isLink(target) || !isMergeTagEntry(target)) {
    return '[Merge Tag]'
  }

  return String(getMergeTagValue(target) ?? '')
}

function extractTextContent(node: RichTextNode, getMergeTagValue: GetMergeTagValue): string {
  if (node.nodeType === 'text' && typeof node.value === 'string') {
    return node.value
  }

  if (node.nodeType === EMBEDDED_ENTRY_NODE_TYPE && isRecord(node.data) && 'target' in node.data) {
    return getMergeTagText(node.data.target, getMergeTagValue)
  }

  if (Array.isArray(node.content)) {
    return node.content.map((child) => extractTextContent(child, getMergeTagValue)).join(' ')
  }

  return ''
}

export function getRichTextContent(
  richText: RichTextDocument,
  getMergeTagValue: GetMergeTagValue,
): string {
  return richText.content
    .map((node) => extractTextContent(node, getMergeTagValue))
    .join(' ')
    .trim()
}

export function RichTextRenderer({ richText }: RichTextRendererProps): JSX.Element {
  const { getMergeTagValue } = useOptimization()

  const renderOptions: Options = {
    renderNode: {
      [INLINES.EMBEDDED_ENTRY]: (node): string => {
        const { data } = node
        if (!isRecord(data) || !('target' in data)) {
          return '[Merge Tag]'
        }

        return getMergeTagText(data.target, getMergeTagValue)
      },
    },
  }

  return <>{documentToReactComponents(richText, renderOptions)}</>
}
