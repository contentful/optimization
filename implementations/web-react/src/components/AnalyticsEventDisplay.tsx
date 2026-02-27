import { type JSX, useEffect, useRef, useState } from 'react'
import { useOptimization } from '../optimization/hooks/useOptimization'
import { isRecord } from '../utils/typeGuards'

interface AnalyticsEvent {
  id: string
  componentId?: string
  pageUrl?: string
  type: string
}

function toPageUrl(event: Record<string, unknown>): string | undefined {
  const { properties } = event
  if (!isRecord(properties)) {
    return undefined
  }

  const { url } = properties
  if (typeof url !== 'string' || url.length === 0) {
    return undefined
  }

  try {
    const normalized = new URL(url, window.location.origin)
    return normalized.pathname
  } catch {
    return url
  }
}

function toAnalyticsEvent(event: unknown, id: string): AnalyticsEvent | undefined {
  if (!isRecord(event) || typeof event.type !== 'string') {
    return undefined
  }

  const componentId = typeof event.componentId === 'string' ? event.componentId : undefined
  const pageUrl = event.type === 'page' ? toPageUrl(event) : undefined

  return {
    id,
    componentId,
    pageUrl,
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

          const label = event.componentId
            ? `${event.type} - Component: ${event.componentId}`
            : event.pageUrl
              ? `${event.type} - URL: ${event.pageUrl}`
              : event.type

          return (
            <li key={event.id} data-testid={testId}>
              {label}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
