import React from 'react'
import { Text, View } from 'react-native'

import { OptimizedEntry, useOptimization } from '@contentful/optimization-react-native'
import { isRichTextDocument } from '@contentful/optimization-react-native/api-schemas'
import type { Entry } from 'contentful'

import { getRichTextContent, RichTextRenderer } from '../components/RichTextRenderer'

interface ContentEntryProps {
  entry: Entry
}

export function ContentEntry({ entry }: ContentEntryProps): React.JSX.Element {
  const sdk = useOptimization()
  const renderContent = (contentEntry: Entry, baselineId: string): React.JSX.Element => {
    const richTextField = Object.values(contentEntry.fields).find(isRichTextDocument)

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
      <OptimizedEntry baselineEntry={entry}>
        {(resolvedEntry) => (
          <View testID={`content-${entry.sys.id}`}>
            {renderContent(resolvedEntry, entry.sys.id)}
          </View>
        )}
      </OptimizedEntry>
    </View>
  )
}
