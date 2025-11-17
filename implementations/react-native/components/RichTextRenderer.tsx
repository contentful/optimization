import React, { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

import type Optimization from '@contentful/optimization-react-native'
import type { MergeTagEntry, Profile } from '@contentful/optimization-react-native'
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
}

function isMergeTagEntry(entry: Entry): entry is MergeTagEntry {
  return entry.sys.contentType.sys.id === 'nt_mergetag'
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

function resolveMergeTagValue(
  includedEntry: MergeTagEntry,
  sdk: Optimization,
  profile: Profile,
): string {
  const resolvedValue = sdk.personalization.getMergeTagValue(includedEntry, profile)

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

function hasMergeTags(node: RichTextNode): boolean {
  if (isEmbeddedEntryInline(node)) {
    return isMergeTagEntry(node.data.target)
  }
  if (node.content) {
    return node.content.some(hasMergeTags)
  }
  return false
}

function hasMergeTagsInRichText(richText: RichTextField): boolean {
  return richText.content.some(hasMergeTags)
}

function renderEmbeddedEntry(
  node: EmbeddedEntryInlineNode,
  sdk: Optimization,
  profile: Profile,
): string {
  const {
    data: { target: includedEntry },
  } = node

  if (!isMergeTagEntry(includedEntry)) {
    return logAndReturnFallback(
      `Failed to resolve merge tag: entry with ID "${includedEntry.sys.id}" is not a merge tag entry (contentType: ${includedEntry.sys.contentType.sys.id})`,
    )
  }

  return resolveMergeTagValue(includedEntry, sdk, profile)
}

export function RichTextRenderer({ richText, sdk }: RichTextRendererProps): React.JSX.Element {
  const [profile, setProfile] = useState<Profile | undefined>(undefined)
  const containsMergeTags = hasMergeTagsInRichText(richText)

  useEffect(() => {
    const subscription = sdk.states.profile.subscribe((currentProfile) => {
      logger.debug(
        '[RichTextRenderer] Profile received:',
        currentProfile
          ? `ID: ${currentProfile.id}, location.continent: ${String(currentProfile.location.continent)}`
          : 'undefined',
      )
      setProfile(currentProfile)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [sdk])

  if (containsMergeTags && !profile) {
    return <View testID="rich-text-renderer" />
  }

  const renderNode = (
    node: RichTextNode,
    index: number,
    paragraphIndex?: number,
  ): React.ReactNode => {
    const textContent = renderTextNode(node)
    if (textContent) {
      return textContent
    }

    if (node.nodeType === 'paragraph' && node.content) {
      const currentParagraphIndex = paragraphIndex ?? 0
      return (
        <Text key={index} testID={`rich-text-paragraph-${currentParagraphIndex}`}>
          {node.content.map((child, childIndex) =>
            renderNode(child, childIndex, currentParagraphIndex),
          )}
        </Text>
      )
    }

    if (isEmbeddedEntryInline(node)) {
      if (!profile) {
        return null
      }
      const mergeTagValue = renderEmbeddedEntry(node, sdk, profile)
      logger.debug(`[RichTextRenderer] Merge tag resolved to: "${mergeTagValue}"`)
      return mergeTagValue
    }

    if (node.content) {
      return node.content.map((child, childIndex) => renderNode(child, childIndex, paragraphIndex))
    }

    return null
  }

  let paragraphIndex = 0
  return (
    <View testID="rich-text-renderer">
      {richText.content.map((node, index) => {
        if (node.nodeType === 'paragraph') {
          const currentIndex = paragraphIndex
          paragraphIndex++
          return renderNode(node, index, currentIndex)
        }
        return renderNode(node, index)
      })}
    </View>
  )
}
