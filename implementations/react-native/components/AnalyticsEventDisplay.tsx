import React, { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

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
      <View style={styles.container}>
        <Text style={styles.title}>Analytics Events</Text>
        <Text style={styles.noEvents}>No events tracked yet</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Analytics Events</Text>
      {events.map((event, index) => (
        <View key={index} style={styles.eventItem}>
          <Text style={styles.eventText}>
            {event.type}
            {event.componentId ? ` - Component: ${event.componentId}` : ''}
          </Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 2,
    borderTopColor: '#333',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  noEvents: {
    fontStyle: 'italic',
    color: '#666',
  },
  eventItem: {
    paddingVertical: 4,
  },
  eventText: {
    fontSize: 14,
  },
})
