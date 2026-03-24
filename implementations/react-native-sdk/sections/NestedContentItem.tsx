import React from 'react'
import { Text, View } from 'react-native'

import { OptimizedEntry } from '@contentful/optimization-react-native'
import type { Entry } from 'contentful'

interface NestedContentItemProps {
  entry: Entry
}

function isEntry(value: unknown): value is Entry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'sys' in value &&
    typeof value.sys === 'object' &&
    value.sys !== null &&
    'id' in value.sys
  )
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
      {nestedEntries.filter(isEntry).map((nestedEntry) => (
        <OptimizedEntry key={nestedEntry.sys.id} entry={nestedEntry}>
          {renderNestedContentItem}
        </OptimizedEntry>
      ))}
    </View>
  )
}

export function NestedContentItem({ entry }: NestedContentItemProps): React.JSX.Element {
  return (
    <OptimizedEntry entry={entry} testID={`nested-personalization-${entry.sys.id}`}>
      {renderNestedContentItem}
    </OptimizedEntry>
  )
}
