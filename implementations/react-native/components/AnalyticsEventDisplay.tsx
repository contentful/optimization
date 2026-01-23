import React, { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

import type Optimization from '@contentful/optimization-react-native'

interface AnalyticsEvent {
  type: string
  componentId?: string
  timestamp: number
}

interface AnalyticsEventDisplayProps {
  sdk: Optimization
}

function isValidEvent(event: unknown): event is { type: string; componentId?: unknown } {
  return (
    event !== null && typeof event === 'object' && 'type' in event && typeof event.type === 'string'
  )
}

export function AnalyticsEventDisplay({ sdk }: AnalyticsEventDisplayProps): React.JSX.Element {
  const [events, setEvents] = useState<AnalyticsEvent[]>([])

  useEffect(() => {
    const handleEvent = (event: unknown): void => {
      if (isValidEvent(event)) {
        const { type, componentId } = event
        const newEvent: AnalyticsEvent = {
          type,
          timestamp: Date.now(),
        }

        if (componentId && typeof componentId === 'string') {
          newEvent.componentId = componentId
        }

        setEvents((prev) => [newEvent, ...prev])
      }
    }

    const subscription = sdk.states.eventStream.subscribe(handleEvent)

    return () => {
      subscription.unsubscribe()
    }
  }, [sdk])

  if (events.length === 0) {
    return (
      <View testID="analytics-events-container">
        <Text>Analytics Events</Text>
        <Text testID="no-events-message">No events tracked yet</Text>
        <Text testID="events-count">Events: 0</Text>
      </View>
    )
  }

  return (
    <View testID="analytics-events-container" style={{ padding: 10 }}>
      <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>Analytics Events</Text>
      <Text testID="events-count">Events: {events.length}</Text>
      {events.map((event, index) => {
        const accessibilityLabel = `${event.type} - Component: ${event.componentId ?? 'none'}`
        return (
          <View
            key={`${event.timestamp}-${index}`}
            testID={`event-${index}`}
            accessibilityLabel={accessibilityLabel}
            accessible={true}
            style={{ marginTop: 5 }}
          >
            <Text>
              {event.type}
              {event.componentId ? ` - Component: ${event.componentId}` : ''}
            </Text>
          </View>
        )
      })}
    </View>
  )
}
