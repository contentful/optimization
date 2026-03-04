import { type JSX, useEffect, useRef, useState } from 'react'
import { useOptimization } from '../optimization/hooks/useOptimization'
import { isRecord } from '../utils/typeGuards'

interface AnalyticsEvent {
  id: string
  componentId?: string
  componentHoverId?: string
  componentViewId?: string
  hoverDurationMs?: number
  pageUrl?: string
  type: string
  viewDurationMs?: number
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
  const componentHoverId =
    typeof event.componentHoverId === 'string' ? event.componentHoverId : undefined
  const componentViewId =
    typeof event.componentViewId === 'string' ? event.componentViewId : undefined
  const hoverDurationMs =
    typeof event.hoverDurationMs === 'number' ? event.hoverDurationMs : undefined
  const pageUrl = event.type === 'page' ? toPageUrl(event) : undefined
  const viewDurationMs = typeof event.viewDurationMs === 'number' ? event.viewDurationMs : undefined

  return {
    id,
    componentId,
    componentHoverId,
    componentViewId,
    hoverDurationMs,
    pageUrl,
    type: event.type,
    viewDurationMs,
  }
}

function isComponentViewHeartbeatEvent(event: AnalyticsEvent): boolean {
  return (
    event.type === 'component' &&
    typeof event.componentViewId === 'string' &&
    typeof event.viewDurationMs === 'number'
  )
}

function isComponentHoverHeartbeatEvent(event: AnalyticsEvent): boolean {
  return (
    event.type === 'component_hover' &&
    typeof event.componentHoverId === 'string' &&
    typeof event.hoverDurationMs === 'number'
  )
}

function getHeartbeatKey(event: AnalyticsEvent): string | undefined {
  if (isComponentViewHeartbeatEvent(event)) {
    return `component:${event.componentViewId}`
  }

  if (isComponentHoverHeartbeatEvent(event)) {
    return `component_hover:${event.componentHoverId}`
  }

  return undefined
}

function upsertAnalyticsEvent(
  previous: AnalyticsEvent[],
  nextEvent: AnalyticsEvent,
): AnalyticsEvent[] {
  const key = getHeartbeatKey(nextEvent)

  if (!key) {
    return [nextEvent, ...previous]
  }

  const existingIndex = previous.findIndex((event) => getHeartbeatKey(event) === key)

  if (existingIndex === -1) {
    return [nextEvent, ...previous]
  }

  const updated = [...previous]
  updated[existingIndex] = { ...nextEvent, id: previous[existingIndex].id }

  return updated
}

export function AnalyticsEventDisplay(): JSX.Element {
  const { sdk, isReady } = useOptimization()
  const [events, setEvents] = useState<AnalyticsEvent[]>([])
  const [rawEventsCount, setRawEventsCount] = useState(0)
  const nextId = useRef(0)

  useEffect(() => {
    if (!isReady || sdk === undefined) {
      setEvents([])
      setRawEventsCount(0)
      nextId.current = 0
      return
    }

    const subscription = sdk.states.eventStream.subscribe((event: unknown) => {
      const id = `event-${nextId.current}`
      const nextEvent = toAnalyticsEvent(event, id)
      if (!nextEvent) {
        return
      }

      nextId.current += 1
      setRawEventsCount((previous) => previous + 1)
      setEvents((previous) => upsertAnalyticsEvent(previous, nextEvent))
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [isReady, sdk])

  return (
    <section data-testid="analytics-events-container">
      <h2>Analytics Events</h2>
      <p data-testid="events-count">Events: {events.length}</p>
      <p data-testid="raw-events-count">Raw Events: {rawEventsCount}</p>
      {events.length === 0 ? <p data-testid="no-events-message">No events tracked yet</p> : null}

      <ul>
        {events.map((event) => {
          const testId = event.componentViewId
            ? `event-${event.type}-view-${event.componentViewId}`
            : event.componentHoverId
              ? `event-${event.type}-hover-${event.componentHoverId}`
              : event.componentId
                ? `event-${event.type}-${event.componentId}`
                : `event-${event.type}-${event.id}`

          const label = event.componentId
            ? typeof event.viewDurationMs === 'number'
              ? `${event.type} - Component: ${event.componentId} - Duration: ${event.viewDurationMs}ms`
              : typeof event.hoverDurationMs === 'number'
                ? `${event.type} - Component: ${event.componentId} - Hover Duration: ${event.hoverDurationMs}ms`
                : `${event.type} - Component: ${event.componentId}`
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
