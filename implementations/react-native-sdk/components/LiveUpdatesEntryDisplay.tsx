import React from 'react'
import { Text, View } from 'react-native'

import type { Entry } from 'contentful'

interface LiveUpdatesEntryDisplayProps {
  entry: Entry
  testIdPrefix: string
}

export function LiveUpdatesEntryDisplay({
  entry,
  testIdPrefix,
}: LiveUpdatesEntryDisplayProps): React.JSX.Element {
  const text = typeof entry.fields.text === 'string' ? entry.fields.text : 'No content'
  const fullLabel = `${text} [Entry: ${entry.sys.id}]`

  return (
    <View testID={`${testIdPrefix}-container`}>
      <Text testID={`${testIdPrefix}-text`} accessibilityLabel={fullLabel}>
        {text}
      </Text>
      <Text testID={`${testIdPrefix}-entry-id`}>Entry: {entry.sys.id}</Text>
    </View>
  )
}
