import React from 'react'
import { Text, View } from 'react-native'

import { Personalization, ScrollProvider } from '@contentful/optimization-react-native'
import type { Entry } from 'contentful'

interface NestedContentEntryProps {
  entry: Entry
}

export function NestedContentEntry({ entry }: NestedContentEntryProps): React.JSX.Element {
  return (
    <View testID={`nested-content-entry-${entry.sys.id}`}>
      <ScrollProvider>
        <Personalization baselineEntry={entry} testID={`nested-personalization-${entry.sys.id}`}>
          {(resolvedEntry, nestedChildren) => {
            const text =
              typeof resolvedEntry.fields.text === 'string'
                ? resolvedEntry.fields.text
                : 'No content'
            const fullLabel = `${text} [Entry: ${resolvedEntry.sys.id}]`

            return (
              <View>
                <View testID={`entry-text-${resolvedEntry.sys.id}`} accessibilityLabel={fullLabel}>
                  <Text>{text}</Text>
                  <Text>{`[Entry: ${resolvedEntry.sys.id}]`}</Text>
                </View>
                {nestedChildren && <View>{nestedChildren}</View>}
              </View>
            )
          }}
        </Personalization>
      </ScrollProvider>
    </View>
  )
}
