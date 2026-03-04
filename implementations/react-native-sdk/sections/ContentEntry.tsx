import React from 'react'
import { Text, View } from 'react-native'

import { Analytics, Personalization, useOptimization } from '@contentful/optimization-react-native'
import { isPersonalizedEntry } from '@contentful/optimization-react-native/api-schemas'
import type { Entry } from 'contentful'

import { getRichTextContent, RichTextRenderer } from '../components/RichTextRenderer'

interface ContentEntryProps {
  entry: Entry
}

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

function isRichTextField(field: unknown): field is RichTextField {
  return (
    typeof field === 'object' &&
    field !== null &&
    'nodeType' in field &&
    (field as { nodeType: unknown }).nodeType === 'document' &&
    'content' in field &&
    Array.isArray((field as { content: unknown }).content)
  )
}

export function ContentEntry({ entry }: ContentEntryProps): React.JSX.Element {
  const sdk = useOptimization()
  const renderContent = (contentEntry: Entry, baselineId: string): React.JSX.Element => {
    const richTextField = Object.values(contentEntry.fields).find(isRichTextField)

    if (richTextField) {
      const textContent = getRichTextContent(richTextField, sdk)
      const fullLabel = `${textContent} [Entry: ${baselineId}]`

      return (
        <View testID={`entry-text-${baselineId}`} accessibilityLabel={fullLabel}>
          <RichTextRenderer richText={richTextField} sdk={sdk} />
          <Text>{`[Entry: ${baselineId}]`}</Text>
        </View>
      )
    }

    const text =
      typeof contentEntry.fields.text === 'string' ? contentEntry.fields.text : 'No content'
    const fullLabel = `${text} [Entry: ${baselineId}]`

    return (
      <View testID={`entry-text-${baselineId}`} accessibilityLabel={fullLabel}>
        <Text>{text}</Text>
        <Text>{`[Entry: ${baselineId}]`}</Text>
      </View>
    )
  }

  return (
    <View testID={`content-entry-${entry.sys.id}`}>
      {isPersonalizedEntry(entry) ? (
        <Personalization baselineEntry={entry} onTap>
          {(resolvedEntry) => (
            <View testID={`content-${entry.sys.id}`}>
              {renderContent(resolvedEntry, entry.sys.id)}
            </View>
          )}
        </Personalization>
      ) : (
        <Analytics entry={entry} onTap>
          <View testID={`content-${entry.sys.id}`}>{renderContent(entry, entry.sys.id)}</View>
        </Analytics>
      )}
    </View>
  )
}
