import { type JSX, useEffect, useRef, useState } from 'react'
import { useOptimization } from '../optimization/hooks/useOptimization'
import { isRecord } from '../utils/typeGuards'

interface AnalyticsEvent {
  id: string
  componentId?: string
  type: string
}

function toAnalyticsEvent(event: unknown, id: string): AnalyticsEvent | undefined {
  if (!isRecord(event) || typeof event.type !== 'string') {
    return undefined
  }

  const componentId = typeof event.componentId === 'string' ? event.componentId : undefined

  return {
    id,
    componentId,
    type: event.type,
  }
}

export function AnalyticsEventDisplay(): JSX.Element {
  const { sdk, isReady } = useOptimization()
  const [events, setEvents] = useState<AnalyticsEvent[]>([])
  const nextId = useRef(0)

  useEffect(() => {
    if (!isReady || sdk === undefined) {
      setEvents([])
      return
    }

    const subscription = sdk.states.eventStream.subscribe((event: unknown) => {
      const id = `event-${nextId.current}`
      nextId.current += 1
      const nextEvent = toAnalyticsEvent(event, id)
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
        {events.map((event) => {
          const testId = event.componentId
            ? `event-${event.type}-${event.componentId}`
            : `event-${event.type}-${event.id}`

          return (
            <li key={event.id} data-testid={testId}>
              {event.type}
              {event.componentId ? ` - Component: ${event.componentId}` : ''}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
