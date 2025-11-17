import React, { useEffect } from 'react'
import { Text, View } from 'react-native'

import type Optimization from '@contentful/optimization-react-native'
import { Analytics, ScrollProvider } from '@contentful/optimization-react-native'
import type { Entry } from 'contentful'

import { TrackingStatus } from '../components/TrackingStatus'

interface AnalyticsSectionProps {
  sdk: Optimization
  analyticsEntry: Entry
}

export function AnalyticsSection({
  sdk,
  analyticsEntry,
}: AnalyticsSectionProps): React.JSX.Element {
  useEffect(() => {
    void sdk.personalization.page({ properties: { url: 'analytics' } })
  }, [sdk])

  const internalTitle =
    typeof analyticsEntry.fields.internalTitle === 'string'
      ? analyticsEntry.fields.internalTitle
      : ''
  const text = typeof analyticsEntry.fields.text === 'string' ? analyticsEntry.fields.text : ''
  return (
    <View testID="analytics-screen">
      <ScrollProvider>
        <Analytics entry={analyticsEntry}>
          <View testID="analytics-content">
            <Text testID="analytics-internal-title">{internalTitle}</Text>
            <Text testID="analytics-content-text">{text}</Text>
            <Text testID="analytics-entry-id">{analyticsEntry.sys.id}</Text>
            <TrackingStatus
              sdk={sdk}
              componentId={analyticsEntry.sys.id}
              testID="analytics-tracking-status"
            />
          </View>
        </Analytics>
      </ScrollProvider>
    </View>
  )
}
