import React, { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

import type Optimization from '@contentful/optimization-react-native'
import { Analytics, ScrollProvider } from '@contentful/optimization-react-native'
import type { Entry } from 'contentful'

interface AnalyticsSectionProps {
  sdk: Optimization
  analyticsEntry: Entry
}

export function AnalyticsSection({
  sdk,
  analyticsEntry,
}: AnalyticsSectionProps): React.JSX.Element {
  const [componentEvents, setComponentEvents] = useState<
    Array<{ componentId: string; type: string }>
  >([])

  useEffect(() => {
    void sdk.personalization.page({ properties: { url: 'analytics' } })
  }, [sdk])

  useEffect(() => {
    const handleComponentEvent = (event: unknown): void => {
      if (
        event &&
        typeof event === 'object' &&
        'type' in event &&
        event.type === 'component' &&
        'componentId' in event &&
        typeof event.componentId === 'string'
      ) {
        const { componentId } = event
        if (componentId === analyticsEntry.sys.id) {
          setComponentEvents((prev) => {
            if (prev.some((e) => e.componentId === componentId)) {
              return prev
            }
            return [...prev, { componentId, type: 'component' }]
          })
        }
      }
    }

    const subscription = sdk.states.eventStream.subscribe(handleComponentEvent)

    return () => {
      subscription.unsubscribe()
    }
  }, [sdk, analyticsEntry.sys.id])

  const text = typeof analyticsEntry.fields.text === 'string' ? analyticsEntry.fields.text : ''

  return (
    <View testID="analytics-section">
      <ScrollProvider>
        <Analytics entry={analyticsEntry}>
          <View testID="analytics-content">
            <Text testID="analytics-content-text">{text}</Text>
            {componentEvents.map((event) => (
              <View testID={`analytics-event-component-${event.componentId}`}>
                <Text key={`analytics-event-${event.componentId}`}>{event.type}</Text>
              </View>
            ))}
          </View>
        </Analytics>
      </ScrollProvider>
    </View>
  )
}
