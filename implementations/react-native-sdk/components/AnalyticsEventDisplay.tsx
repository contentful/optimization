import React, { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

import { useOptimization } from '@contentful/optimization-react-native'

interface AnalyticsEvent {
  type: string
  componentId?: string
  viewDurationMs?: number
  componentViewId?: string
  timestamp: number
}

function isValidEvent(event: unknown): event is {
  type: string
  componentId?: unknown
  viewDurationMs?: unknown
  componentViewId?: unknown
} {
  return (
    event !== null && typeof event === 'object' && 'type' in event && typeof event.type === 'string'
  )
}

interface ComponentStats {
  count: number
  latestViewDurationMs: number | undefined
  latestComponentViewId: string | undefined
}

export function AnalyticsEventDisplay(): React.JSX.Element {
  const sdk = useOptimization()
  const [events, setEvents] = useState<AnalyticsEvent[]>([])
  const [componentStats, setComponentStats] = useState<Record<string, ComponentStats>>({})
  useEffect(() => {
    const handleEvent = (event: unknown): void => {
      if (isValidEvent(event)) {
        const { type, componentId, viewDurationMs, componentViewId } = event
        const newEvent: AnalyticsEvent = {
          type,
          timestamp: Date.now(),
        }

        if (componentId && typeof componentId === 'string') {
          newEvent.componentId = componentId
        }

        if (typeof viewDurationMs === 'number') {
          newEvent.viewDurationMs = viewDurationMs
        }

        if (typeof componentViewId === 'string') {
          newEvent.componentViewId = componentViewId
        }

        setEvents((prev) => [newEvent, ...prev])

        if (newEvent.componentId && type === 'component') {
          const { componentId: cid } = newEvent
          setComponentStats((prev) => {
            const { [cid]: existing } = prev
            return {
              ...prev,
              [cid]: {
                count: (existing?.count ?? 0) + 1,
                latestViewDurationMs: newEvent.viewDurationMs ?? existing?.latestViewDurationMs,
                latestComponentViewId: newEvent.componentViewId ?? existing?.latestComponentViewId,
              },
            }
          })
        }
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

      {events
        .filter((event) => event.type !== 'component')
        .map((event, index) => {
          const accessibilityLabel = `${event.type} - Component: ${event.componentId ?? 'none'} - Duration: ${event.viewDurationMs ?? 'none'}`
          const testID = event.componentId
            ? `event-${event.type}-${event.componentId}`
            : `event-${event.type}-${index}`
          return (
            <View
              key={`${event.timestamp}-${index}`}
              testID={testID}
              accessibilityLabel={accessibilityLabel}
              accessible={true}
              style={{ marginTop: 5 }}
            >
              <Text>
                {event.type}
                {event.componentId ? ` - Component: ${event.componentId}` : ''}
                {event.viewDurationMs !== undefined ? ` - ${event.viewDurationMs}ms` : ''}
              </Text>
            </View>
          )
        })}

      {Object.entries(componentStats).map(([cid, stats]) => (
        <View key={`stats-${cid}`} testID={`component-stats-${cid}`}>
          <Text testID={`event-count-${cid}`}>Count: {stats.count}</Text>
          <Text testID={`event-duration-${cid}`}>
            Duration: {stats.latestViewDurationMs ?? 'N/A'}
          </Text>
          <Text testID={`event-view-id-${cid}`}>
            ViewId: {stats.latestComponentViewId ?? 'N/A'}
          </Text>
        </View>
      ))}
    </View>
  )
}
