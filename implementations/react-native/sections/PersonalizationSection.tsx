import React, { useEffect } from 'react'
import { Text, View } from 'react-native'

import type Optimization from '@contentful/optimization-react-native'
import { Personalization, ScrollProvider } from '@contentful/optimization-react-native'
import type { Entry } from 'contentful'

import { TrackingStatus } from '../components/TrackingStatus'

interface PersonalizationSectionProps {
  sdk: Optimization
  personalizationEntry: Entry
}

export function PersonalizationSection({
  sdk,
  personalizationEntry,
}: PersonalizationSectionProps): React.JSX.Element {
  useEffect(() => {
    void sdk.personalization.page({ properties: { url: 'personalization' } })
  }, [sdk])

  const internalTitle =
    typeof personalizationEntry.fields.internalTitle === 'string'
      ? personalizationEntry.fields.internalTitle
      : ''
  const text =
    typeof personalizationEntry.fields.text === 'string' ? personalizationEntry.fields.text : ''

  return (
    <View testID="personalization-screen">
      <ScrollProvider>
        <Personalization baselineEntry={personalizationEntry}>
          {(resolvedEntry) => (
            <View testID="personalization-content">
              <Text testID="personalization-internal-title">{internalTitle}</Text>
              <Text testID="personalization-content-text">{text}</Text>
              <Text testID="personalization-entry-id">{resolvedEntry.sys.id}</Text>
              <TrackingStatus
                sdk={sdk}
                componentId={personalizationEntry.sys.id}
                testID="personalization-tracking-status"
              />
            </View>
          )}
        </Personalization>
      </ScrollProvider>
    </View>
  )
}
