import React from 'react'
import { Text } from 'react-native'

import { createScopedLogger, type ScopedLogger } from '@contentful/optimization-core/logger'
import type { OptimizationReactNativeSdk } from '@contentful/optimization-react-native'
import {
  isMergeTagEntry,
  type MergeTagEntry,
} from '@contentful/optimization-react-native/api-schemas'
import type { Entry } from 'contentful'

const logger: ScopedLogger = createScopedLogger('Demo:RichText')

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
  sdk: OptimizationReactNativeSdk
}

type RenderedRichTextNode = string | null | React.ReactElement

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
  logger.error(message)
  return '[Merge Tag]'
}

function convertToString(value: unknown): string {
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value)
  }
  return String(value)
}

function resolveMergeTagValue(
  includedEntry: MergeTagEntry,
  sdk: OptimizationReactNativeSdk,
): string {
  const resolvedValue = sdk.getMergeTagValue(includedEntry)

  if (resolvedValue === undefined) {
    logger.error(
      `Failed to resolve merge tag: getMergeTagValue returned ${String(resolvedValue)} for merge tag "${includedEntry.fields.nt_name}" (nt_mergetag_id: ${includedEntry.fields.nt_mergetag_id})`,
    )
    return includedEntry.fields.nt_fallback?.toString() ?? '[Merge Tag]'
  }

  const valueString = convertToString(resolvedValue)
  logger.debug(
    `Successfully resolved merge tag "${includedEntry.fields.nt_name}" to value: ${valueString}`,
  )
  return valueString
}

function getLinkId(link: unknown): string {
  if (typeof link !== 'object' || link === null || !('sys' in link)) {
    return 'unknown'
  }
  const { sys } = link as { sys?: unknown }
  if (typeof sys !== 'object' || sys === null || !('id' in sys)) {
    return 'unknown'
  }
  const { id } = sys as { id?: unknown }
  return typeof id === 'string' ? id : 'unknown'
}

function renderEmbeddedEntry(
  node: EmbeddedEntryInlineNode,
  sdk: OptimizationReactNativeSdk,
): string {
  const {
    data: { target: includedEntry },
  } = node

  if (isLink(includedEntry)) {
    return logAndReturnFallback(
      `Target is still a Link after Contentful SDK resolution: ${getLinkId(includedEntry)}. This should not happen when using getEntry() with include parameter.`,
    )
  }

  if (isMergeTagEntry(includedEntry)) {
    return resolveMergeTagValue(includedEntry, sdk)
  }

  return logAndReturnFallback('Failed to resolve merge tag: entry is not a merge tag')
}

function extractTextContent(node: RichTextNode, sdk: OptimizationReactNativeSdk): string {
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

export function getRichTextContent(
  richText: RichTextField,
  sdk: OptimizationReactNativeSdk,
): string {
  return richText.content.map((node) => extractTextContent(node, sdk)).join(' ')
}

export function RichTextRenderer({ richText, sdk }: RichTextRendererProps): React.ReactElement {
  const renderNode = (node: RichTextNode, index: number): RenderedRichTextNode => {
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
      logger.debug(`Merge tag resolved to: "${mergeTagValue}"`)
      return mergeTagValue
    }

    if (node.content) {
      return <>{node.content.map((child, childIndex) => renderNode(child, childIndex))}</>
    }

    return null
  }

  return <>{richText.content.map((node, index) => renderNode(node, index))}</>
}
