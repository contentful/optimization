import React from 'react'
import { Text } from 'react-native'

import type Optimization from '@contentful/optimization-react-native'
import type { MergeTagEntry } from '@contentful/optimization-react-native'
import { logger } from '@contentful/optimization-react-native'
import type { Entry } from 'contentful'

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
  entry: Entry
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
  logger.error(`[RichTextRenderer] ${message}`)
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
      `[RichTextRenderer] Failed to resolve merge tag: getMergeTagValue returned ${String(resolvedValue)} for merge tag "${includedEntry.fields.nt_name}" (nt_mergetag_id: ${includedEntry.fields.nt_mergetag_id})`,
    )
    return includedEntry.fields.nt_fallback?.toString() ?? '[Merge Tag]'
  }

  const valueString = convertToString(resolvedValue)
  logger.debug(
    `[RichTextRenderer] Successfully resolved merge tag "${includedEntry.fields.nt_name}" to value: ${valueString}`,
  )
  return valueString
}

function renderEmbeddedEntry(
  node: EmbeddedEntryInlineNode,
  sdk: Optimization,
  parentEntry: Entry,
): string {
  const { data } = node
  let { target: includedEntry } = data

  // If target is a Link reference, resolve it from the parent entry's includes
  if (isLink(includedEntry)) {
    logger.debug(
      `[RichTextRenderer] Target is a Link, resolving from includes: ${includedEntry.sys.id}`,
    )

    // TypeScript type guard to check if entry has includes
    const entryWithIncludes = parentEntry as Entry & { includes?: { Entry?: Entry[] } }

    if (entryWithIncludes.includes?.Entry) {
      const resolved = entryWithIncludes.includes.Entry.find(
        (e) => e.sys.id === includedEntry.sys.id,
      )
      if (resolved) {
        logger.debug(`[RichTextRenderer] Resolved Link ${includedEntry.sys.id} to entry`)
        includedEntry = resolved
      } else {
        return logAndReturnFallback(
          `Failed to resolve Link reference: ${includedEntry.sys.id} not found in includes`,
        )
      }
    } else {
      return logAndReturnFallback('Failed to resolve Link reference: no includes available')
    }
  }

  if (isMergeTagEntry(includedEntry)) {
    return resolveMergeTagValue(includedEntry, sdk)
  }

  return logAndReturnFallback('Failed to resolve merge tag: entry is not a merge tag')
}

export function RichTextRenderer({
  richText,
  sdk,
  entry,
}: RichTextRendererProps): React.JSX.Element {
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
      const mergeTagValue = renderEmbeddedEntry(node, sdk, entry)
      logger.debug(`[RichTextRenderer] Merge tag resolved to: "${mergeTagValue}"`)
      return mergeTagValue
    }

    if (node.content) {
      return node.content.map((child, childIndex) => renderNode(child, childIndex))
    }

    return null
  }

  return <>{richText.content.map((node, index) => renderNode(node, index))}</>
}
