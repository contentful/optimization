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

  return (
    <View testID="personalization-section">
      <ScrollProvider>
        <Personalization baselineEntry={personalizationEntry}>
          {(resolvedEntry) => {
            const internalTitle =
              typeof resolvedEntry.fields.internalTitle === 'string'
                ? resolvedEntry.fields.internalTitle
                : ''
            const text =
              typeof resolvedEntry.fields.text === 'string' ? resolvedEntry.fields.text : ''

            return (
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
            )
          }}
        </Personalization>
      </ScrollProvider>
    </View>
  )
}
