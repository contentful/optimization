import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type Optimization from '@contentful/optimization-react-native'
import { Analytics, Personalization, ScrollProvider } from '@contentful/optimization-react-native'
import type { Entry } from 'contentful'

import { RichTextRenderer, getRichTextContent } from '../components/RichTextRenderer'
import { NestedContentEntry } from './NestedContentEntry'

interface ContentEntryProps {
  entry: Entry
  sdk: Optimization
}

function isNestedContentType(entry: Entry): boolean {
  return entry.sys.contentType?.sys?.id === 'nestedContent'
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

export function ContentEntry({ entry, sdk }: ContentEntryProps): React.JSX.Element {
  if (isNestedContentType(entry)) {
    return <NestedContentEntry entry={entry} />
  }

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
    <View style={styles.container} testID={`content-entry-${entry.sys.id}`}>
      <ScrollProvider>
        <Personalization baselineEntry={entry}>
          {(resolvedEntry) => (
            <Analytics entry={resolvedEntry}>
              <View testID={`content-${entry.sys.id}`}>
                {renderContent(resolvedEntry, entry.sys.id)}
              </View>
            </Analytics>
          )}
        </Personalization>
      </ScrollProvider>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {},
})
