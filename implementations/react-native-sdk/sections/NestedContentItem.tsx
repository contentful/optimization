import React from 'react'
import { Text, View } from 'react-native'

import { OptimizedEntry } from '@contentful/optimization-react-native'
import { isResolvedContentfulEntry } from '@contentful/optimization-react-native/api-schemas'
import type { Entry } from 'contentful'

interface NestedContentItemProps {
  entry: Entry
}

function renderNestedContentItem(resolvedEntry: Entry): React.JSX.Element {
  const text = typeof resolvedEntry.fields.text === 'string' ? resolvedEntry.fields.text : ''
  const nestedEntries = Array.isArray(resolvedEntry.fields.nested)
    ? (resolvedEntry.fields.nested as unknown[])
    : []
  const fullLabel = `${text} [Entry: ${resolvedEntry.sys.id}]`

  return (
    <View>
      <View testID={`entry-text-${resolvedEntry.sys.id}`} accessibilityLabel={fullLabel}>
        <Text>{text}</Text>
        <Text>{`[Entry: ${resolvedEntry.sys.id}]`}</Text>
      </View>
      {nestedEntries.filter(isResolvedContentfulEntry).map((nestedEntry) => (
        <OptimizedEntry key={nestedEntry.sys.id} baselineEntry={nestedEntry}>
          {renderNestedContentItem}
        </OptimizedEntry>
      ))}
    </View>
  )
}

export function NestedContentItem({ entry }: NestedContentItemProps): React.JSX.Element {
  return (
    <OptimizedEntry baselineEntry={entry} testID={`nested-optimization-${entry.sys.id}`}>
      {renderNestedContentItem}
    </OptimizedEntry>
  )
}
