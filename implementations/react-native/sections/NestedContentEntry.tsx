import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { NestedPersonalization, ScrollProvider } from '@contentful/optimization-react-native'
import type { Entry } from 'contentful'

interface NestedContentEntryProps {
  entry: Entry
}

export function NestedContentEntry({ entry }: NestedContentEntryProps): React.JSX.Element {
  return (
    <View style={styles.container} testID={`nested-content-entry-${entry.sys.id}`}>
      <ScrollProvider>
        <NestedPersonalization
          baselineEntry={entry}
          testID={`nested-personalization-${entry.sys.id}`}
        >
          {(resolvedEntry, nestedChildren) => {
            const text =
              typeof resolvedEntry.fields.text === 'string'
                ? resolvedEntry.fields.text
                : 'No content'
            const fullLabel = `${text} [Entry: ${resolvedEntry.sys.id}]`

            return (
              <View style={styles.entryContent}>
                <View
                  testID={`entry-text-${resolvedEntry.sys.id}`}
                  accessibilityLabel={fullLabel}
                  style={styles.textContainer}
                >
                  <Text style={styles.text}>{text}</Text>
                  <Text style={styles.entryId}>{`[Entry: ${resolvedEntry.sys.id}]`}</Text>
                </View>
                {nestedChildren && <View style={styles.nestedContainer}>{nestedChildren}</View>}
              </View>
            )
          }}
        </NestedPersonalization>
      </ScrollProvider>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  entryContent: {
    padding: 8,
  },
  textContainer: {
    marginBottom: 4,
  },
  text: {
    fontSize: 14,
  },
  entryId: {
    fontSize: 12,
    color: '#666',
  },
  nestedContainer: {
    marginLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: '#ddd',
    paddingLeft: 8,
  },
})
