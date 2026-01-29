import React from 'react'
import { Text } from 'react-native'

import type Optimization from '@contentful/optimization-react-native'
import type { MergeTagEntry } from '@contentful/optimization-react-native'
import { logger } from '@contentful/optimization-react-native'
import type { Entry } from 'contentful'

const LOG_LOCATION = 'Demo:RichText'

interface RichTextNode {
  nodeType: string
  data?: unknown
  content?: RichTextNode[]
  value?: string
}

interface RichTextField {
  nodeType: 'document'
  content: RichTextNode[]
}

interface EmbeddedEntryInlineNode {
  nodeType: 'embedded-entry-inline'
  data: {
    target: Entry
  }
}

interface RichTextRendererProps {
  richText: RichTextField
  sdk: Optimization
}

function isMergeTagEntry(entry: Entry): entry is MergeTagEntry {
  return entry.sys.contentType.sys.id === 'nt_mergetag'
}

function isLink(target: unknown): boolean {
  if (typeof target !== 'object' || target === null) {
    return false
  }

  const { sys } = target as { sys?: unknown }
  if (typeof sys !== 'object' || sys === null) {
    return false
  }

  const { type } = sys as { type?: unknown }
  return type === 'Link'
}

function isEmbeddedEntryInline(node: RichTextNode): node is EmbeddedEntryInlineNode {
  return node.nodeType === 'embedded-entry-inline'
}

function renderTextNode(node: RichTextNode): string | null {
  if (node.nodeType === 'text' && node.value) {
    return node.value
  }
  return null
}

function logAndReturnFallback(message: string): string {
  logger.error(LOG_LOCATION, message)
  return '[Merge Tag]'
}

function convertToString(value: unknown): string {
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value)
  }
  return String(value)
}

function resolveMergeTagValue(includedEntry: MergeTagEntry, sdk: Optimization): string {
  const resolvedValue = sdk.personalization.getMergeTagValue(includedEntry)

  if (resolvedValue === undefined || resolvedValue === null) {
    logger.error(
      LOG_LOCATION,
      `Failed to resolve merge tag: getMergeTagValue returned ${String(resolvedValue)} for merge tag "${includedEntry.fields.nt_name}" (nt_mergetag_id: ${includedEntry.fields.nt_mergetag_id})`,
    )
    return includedEntry.fields.nt_fallback?.toString() ?? '[Merge Tag]'
  }

  const valueString = convertToString(resolvedValue)
  logger.debug(
    LOG_LOCATION,
    `Successfully resolved merge tag "${includedEntry.fields.nt_name}" to value: ${valueString}`,
  )
  return valueString
}

function renderEmbeddedEntry(node: EmbeddedEntryInlineNode, sdk: Optimization): string {
  const { data } = node
  const { target: includedEntry } = data

  if (isLink(includedEntry)) {
    return logAndReturnFallback(
      `Target is still a Link after Contentful SDK resolution: ${includedEntry.sys.id}. This should not happen when using getEntry() with include parameter.`,
    )
  }

  if (isMergeTagEntry(includedEntry)) {
    return resolveMergeTagValue(includedEntry, sdk)
  }

  return logAndReturnFallback('Failed to resolve merge tag: entry is not a merge tag')
}

function extractTextContent(node: RichTextNode, sdk: Optimization): string {
  const textContent = renderTextNode(node)
  if (textContent) {
    return textContent
  }

  if (isEmbeddedEntryInline(node)) {
    return renderEmbeddedEntry(node, sdk)
  }

  if (node.content) {
    return node.content.map((child) => extractTextContent(child, sdk)).join('')
  }

  return ''
}

export function getRichTextContent(richText: RichTextField, sdk: Optimization): string {
  return richText.content.map((node) => extractTextContent(node, sdk)).join(' ')
}

export function RichTextRenderer({ richText, sdk }: RichTextRendererProps): React.JSX.Element {
  const renderNode = (node: RichTextNode, index: number): React.ReactNode => {
    const textContent = renderTextNode(node)
    if (textContent) {
      return textContent
    }

    if (node.nodeType === 'paragraph' && node.content) {
      return (
        <Text key={index}>
          {node.content.map((child, childIndex) => renderNode(child, childIndex))}
        </Text>
      )
    }

    if (isEmbeddedEntryInline(node)) {
      const mergeTagValue = renderEmbeddedEntry(node, sdk)
      logger.debug(LOG_LOCATION, `Merge tag resolved to: "${mergeTagValue}"`)
      return mergeTagValue
    }

    if (node.content) {
      return node.content.map((child, childIndex) => renderNode(child, childIndex))
    }

    return null
  }

  return <>{richText.content.map((node, index) => renderNode(node, index))}</>
}
