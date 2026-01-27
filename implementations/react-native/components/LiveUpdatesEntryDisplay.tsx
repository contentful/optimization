import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { Entry } from 'contentful'

interface LiveUpdatesEntryDisplayProps {
  entry: Entry
  testIdPrefix: string
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    marginVertical: 4,
  },
  text: {
    fontSize: 14,
    color: '#333',
  },
  entryId: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
})

export function LiveUpdatesEntryDisplay({
  entry,
  testIdPrefix,
}: LiveUpdatesEntryDisplayProps): React.JSX.Element {
  const text = typeof entry.fields.text === 'string' ? entry.fields.text : 'No content'
  const fullLabel = `${text} [Entry: ${entry.sys.id}]`

  return (
    <View testID={`${testIdPrefix}-container`} style={styles.container}>
      <Text testID={`${testIdPrefix}-text`} accessibilityLabel={fullLabel} style={styles.text}>
        {text}
      </Text>
      <Text testID={`${testIdPrefix}-entry-id`} style={styles.entryId}>
        Entry: {entry.sys.id}
      </Text>
    </View>
  )
}
