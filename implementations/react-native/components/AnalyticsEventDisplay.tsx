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

        setEvents((prev) => [...prev, newEvent])
      }
    }

    const subscription = sdk.states.eventStream.subscribe(handleEvent)

    return () => {
      subscription.unsubscribe()
    }
  }, [sdk])

  if (events.length === 0) {
    return (
      <View>
        <Text>Analytics Events</Text>
        <Text>No events tracked yet</Text>
      </View>
    )
  }

  return (
    <View>
      <Text>Analytics Events</Text>
      {events.map((event, index) => (
        <View key={index}>
          <Text>
            {event.type}
            {event.componentId ? ` - Component: ${event.componentId}` : ''}
          </Text>
        </View>
      ))}
    </View>
  )
}
