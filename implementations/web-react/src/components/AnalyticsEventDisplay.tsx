import { type JSX, useEffect, useState } from 'react'
import { useOptimization } from '../optimization/hooks/useOptimization'

interface AnalyticsEvent {
  componentId?: string
  timestamp: number
  type: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toAnalyticsEvent(event: unknown): AnalyticsEvent | undefined {
  if (!isRecord(event) || typeof event.type !== 'string') {
    return undefined
  }

  const componentId = typeof event.componentId === 'string' ? event.componentId : undefined

  return {
    componentId,
    timestamp: Date.now(),
    type: event.type,
  }
}

export function AnalyticsEventDisplay(): JSX.Element {
  const { sdk, isReady } = useOptimization()
  const [events, setEvents] = useState<AnalyticsEvent[]>([])

  useEffect(() => {
    if (!isReady || sdk === undefined) {
      setEvents([])
      return
    }

    const subscription = sdk.states.eventStream.subscribe((event: unknown) => {
      const nextEvent = toAnalyticsEvent(event)
      if (!nextEvent) {
        return
      }

      setEvents((previous) => [nextEvent, ...previous])
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [isReady, sdk])

  return (
    <section data-testid="analytics-events-container">
      <h2>Analytics Events</h2>
      <p data-testid="events-count">Events: {events.length}</p>
      {events.length === 0 ? <p data-testid="no-events-message">No events tracked yet</p> : null}

      <ul>
        {events.map((event, index) => {
          const key = `${event.timestamp}-${index}`
          const testId = event.componentId
            ? `event-${event.type}-${event.componentId}`
            : `event-${event.type}-${index}`

          return (
            <li key={key} data-testid={testId}>
              {event.type}
              {event.componentId ? ` - Component: ${event.componentId}` : ''}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
