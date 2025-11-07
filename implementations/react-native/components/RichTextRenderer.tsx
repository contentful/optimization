import React, { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

import type Optimization from '@contentful/optimization-react-native'
import type { MergeTagEntry, Profile } from '@contentful/optimization-react-native'
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
    target: {
      sys: {
        id: string
        type: string
        linkType: string
      }
    }
  }
}

interface RichTextRendererProps {
  richText: RichTextField
  sdk: Optimization
  includes?: { Entry?: Entry[] }
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

function renderEmbeddedEntry(
  node: EmbeddedEntryInlineNode,
  includes: { Entry?: Entry[] } | undefined,
  sdk: Optimization,
  profile: Profile | undefined,
): string {
  const {
    data: {
      target: {
        sys: { id: targetId },
      },
    },
  } = node
  const includedEntry = includes?.Entry?.find((entry) => entry.sys.id === targetId)

  if (includedEntry && isMergeTagEntry(includedEntry) && profile) {
    const resolvedValue = sdk.personalization.getMergeTagValue(includedEntry, profile)
    return resolvedValue?.toString() ?? ''
  }

  return '[Merge Tag]'
}

export function RichTextRenderer({
  richText,
  sdk,
  includes,
}: RichTextRendererProps): React.JSX.Element {
  const [profile, setProfile] = useState<Profile | undefined>(undefined)

  useEffect(() => {
    const subscription = sdk.states.profile.subscribe((currentProfile) => {
      setProfile(currentProfile)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [sdk])

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
      return renderEmbeddedEntry(node, includes, sdk, profile)
    }

    if (node.content) {
      return node.content.map((child, childIndex) => renderNode(child, childIndex))
    }

    return null
  }

  return <View>{richText.content.map((node, index) => renderNode(node, index))}</View>
}
