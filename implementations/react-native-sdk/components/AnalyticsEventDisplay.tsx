import React, { useEffect, useState } from 'react'
import { Text, View } from 'react-native'

import { useOptimization } from '@contentful/optimization-react-native'

interface AnalyticsEvent {
  type: string
  componentId?: string
  viewDurationMs?: number
  viewId?: string
  timestamp: number
}

function isValidEvent(event: unknown): event is {
  type: string
  componentId?: unknown
  viewDurationMs?: unknown
  viewId?: unknown
} {
  return (
    event !== null && typeof event === 'object' && 'type' in event && typeof event.type === 'string'
  )
}

interface EntryStats {
  count: number
  latestViewDurationMs: number | undefined
  latestViewId: string | undefined
}

// Module-level stores that persist across unmount/remount cycles within the same
// app session. Cleared naturally when the app process restarts (relaunchCleanApp).
let persistedEvents: AnalyticsEvent[] = []
let persistedEntryStats: Record<string, EntryStats> = {}

// Callback to trigger a re-render when mounted; null when unmounted.
let rerender: (() => void) | null = null

// Active subscription kept alive across unmounts to capture cleanup events.
let activeSubscription: { unsubscribe: () => void } | null = null

function buildEvent(event: {
  type: string
  componentId?: unknown
  viewDurationMs?: unknown
  viewId?: unknown
}): AnalyticsEvent {
  const { type, componentId, viewDurationMs, viewId } = event
  const newEvent: AnalyticsEvent = { type, timestamp: Date.now() }

  if (componentId && typeof componentId === 'string') {
    newEvent.componentId = componentId
  }
  if (typeof viewDurationMs === 'number') {
    newEvent.viewDurationMs = viewDurationMs
  }
  if (typeof viewId === 'string') {
    newEvent.viewId = viewId
  }

  return newEvent
}

function updateEntryStats(newEvent: AnalyticsEvent): void {
  if (!newEvent.componentId || newEvent.type !== 'component') return

  const { componentId: cid } = newEvent
  const { [cid]: existing } = persistedEntryStats
  persistedEntryStats = {
    ...persistedEntryStats,
    [cid]: {
      count: (existing?.count ?? 0) + 1,
      latestViewDurationMs: newEvent.viewDurationMs ?? existing?.latestViewDurationMs,
      latestViewId: newEvent.viewId ?? existing?.latestViewId,
    },
  }
}

function processEvent(event: unknown): void {
  if (!isValidEvent(event)) return

  const newEvent = buildEvent(event)
  persistedEvents = [newEvent, ...persistedEvents]
  updateEntryStats(newEvent)
  rerender?.()
}

export function AnalyticsEventDisplay(): React.JSX.Element {
  const sdk = useOptimization()
  const [, setTick] = useState(0)

  useEffect(() => {
    rerender = () => {
      setTick((n) => n + 1)
    }

    // (Re)subscribe when SDK instance changes (e.g. after reset).
    activeSubscription?.unsubscribe()
    activeSubscription = sdk.states.eventStream.subscribe(processEvent)

    return () => {
      rerender = null
      // Intentionally keep subscription alive to capture events emitted
      // during sibling component cleanup (e.g. final view tracking events).
    }
  }, [sdk])

  const events = persistedEvents
  const entryStats = persistedEntryStats

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
          const accessibilityLabel = `${event.type} - Entry/Flag: ${event.componentId ?? 'none'} - Duration: ${event.viewDurationMs ?? 'none'}`
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
                {event.componentId ? ` - Entry/Flag: ${event.componentId}` : ''}
                {event.viewDurationMs !== undefined ? ` - ${event.viewDurationMs}ms` : ''}
              </Text>
            </View>
          )
        })}

      {Object.entries(entryStats).map(([cid, stats]) => (
        <View key={`stats-${cid}`} testID={`entry-stats-${cid}`}>
          <Text testID={`event-count-${cid}`}>Count: {stats.count}</Text>
          <Text testID={`event-duration-${cid}`}>
            Duration: {stats.latestViewDurationMs ?? 'N/A'}
          </Text>
          <Text testID={`event-view-id-${cid}`}>ViewId: {stats.latestViewId ?? 'N/A'}</Text>
        </View>
      ))}
    </View>
  )
}
