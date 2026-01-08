import React from 'react'
import { View } from 'react-native'

import { ScrollProvider } from '@contentful/optimization-react-native'
import type { Entry } from 'contentful'

import { NestedContentItem } from './NestedContentItem'

interface NestedContentEntryProps {
  entry: Entry
}

export function NestedContentEntry({ entry }: NestedContentEntryProps): React.JSX.Element {
  return (
    <View testID={`nested-content-entry-${entry.sys.id}`}>
      <ScrollProvider>
        <NestedContentItem entry={entry} />
      </ScrollProvider>
    </View>
  )
}
